import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { hueFromString } from '../lib/id';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';
import { useAppStore } from './useAppStore';

type AuthError = Error | null;

export interface StoredAccount {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  token: string;
  refresh_token?: string;
  active?: boolean;
}

const ACCOUNTS_KEY = 'beacon_stored_accounts';
function accounts(): StoredAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as StoredAccount[]; } catch { return []; }
}
function saveAccounts(next: StoredAccount[]): void { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next)); }
function saveSession(session: Session): void {
  const metadata = session.user.user_metadata ?? {};
  const next: StoredAccount = { id: session.user.id, email: session.user.email ?? '', username: String(metadata.username || metadata.user_name || session.user.email?.split('@')[0] || 'beacon_user'), avatar_url: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : undefined, token: session.access_token, refresh_token: session.refresh_token, active: true };
  saveAccounts([...accounts().filter((account) => account.id !== next.id).map((account) => ({ ...account, active: false })), next]);
}

interface AuthState {
  ready: boolean;
  user: User | null;
  demoMode: boolean;
  guest: boolean;
  initialize: () => () => void;
  continueAsGuest: () => void;
  signIn: (email: string, password: string) => Promise<AuthError>;
  signUp: (email: string, password: string, username?: string) => Promise<AuthError>;
  signInWithUsername: (username: string, password: string) => Promise<AuthError>;
  signUpWithUsername: (username: string, password: string) => Promise<AuthError>;
  signInWithGoogle: () => Promise<AuthError>;
  storedAccounts: () => StoredAccount[];
  addAccount: (session: Session) => void;
  switchAccount: (accountId: string) => Promise<AuthError>;
  removeAccount: (accountId: string) => void;
  logout: () => Promise<AuthError>;
}

function usernameEmail(username: string): string | null {
  const handle = username.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(handle) ? `${handle}@beacon.local` : null;
}

function syncUser(user: User | null): void {
  if (!user) return;
  const metadata = user.user_metadata ?? {};
  const username = String(metadata.username || metadata.user_name || user.email?.split('@')[0] || 'beacon_user')
    .replace(/\s+/g, '_')
    .slice(0, 24);
  useAppStore.getState().setAppUser({
    id: user.id,
    username,
    displayName: String(metadata.full_name || metadata.name || username),
    avatarColor: `hsl(${hueFromString(user.id)} 55% 55%)`,
    avatar: undefined, banner: undefined, bannerFrom: undefined, bannerTo: undefined, effect: undefined,
    bio: undefined, pronouns: undefined, customStatus: '',
  });
  void supabase.from('profiles').select('*').eq('id', user.id).limit(1).then(({ data, error }) => {
    const profile = !error ? data?.[0] : null;
    if (!profile || useAuthStore.getState().user?.id !== user.id) return;
    useAppStore.getState().setAppUser({
      username: String(profile.username || username), displayName: String(profile.display_name || metadata.full_name || metadata.name || username),
      customStatus: String(profile.custom_status || ''), bio: profile.bio || undefined, pronouns: profile.pronouns || undefined,
      avatarColor: String(profile.avatar_color || `hsl(${hueFromString(user.id)} 55% 55%)`),
      avatar: profile.avatar ?? undefined, banner: profile.banner ?? undefined,
    });
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  user: null,
  demoMode: !IS_SUPABASE_CONFIGURED,
  guest: false,

  initialize: () => {
    if (!IS_SUPABASE_CONFIGURED) {
      set({ ready: true, demoMode: true });
      return () => undefined;
    }
    void supabase.auth.getSession().then(({ data }) => {
      set({ ready: true, user: data.session?.user ?? null, demoMode: false });
      if (data.session) saveSession(data.session);
      syncUser(data.session?.user ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ ready: true, user: session?.user ?? null, demoMode: false, guest: false });
      if (session) saveSession(session);
      syncUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  },

  continueAsGuest: () => {
    const app = useAppStore.getState();
    if (!app.onboarded) app.completeOnboarding('Guest', '#7c5cfc');
    app.seedIfEmpty();
    set({ ready: true, guest: true, demoMode: true });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error;
  },
  signUp: async (email, password, username) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: username ? { username } : undefined },
    });
    return error;
  },
  signInWithUsername: async (username, password) => {
    const email = usernameEmail(username);
    if (!email) return new Error('Choose a username with 3–24 letters, numbers, or underscores.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  },
  signUpWithUsername: async (username, password) => {
    const email = usernameEmail(username);
    if (!email) return new Error('Choose a username with 3–24 letters, numbers, or underscores.');
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { username: username.trim() } } });
    return error;
  },
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return error;
  },
  storedAccounts: accounts,
  addAccount: saveSession,
  switchAccount: async (accountId) => {
    const account = accounts().find((item) => item.id === accountId);
    if (!account) return new Error('Saved account not found.');
    if (!account.refresh_token) return new Error('This account needs to sign in again.');
    const { data, error } = await supabase.auth.setSession({ access_token: account.token, refresh_token: account.refresh_token });
    if (error || !data.session) return error ?? new Error('Could not restore this account.');
    saveSession(data.session);
    useAppStore.getState().clearAppState();
    set({ user: data.session.user, guest: false, demoMode: false });
    syncUser(data.session.user);
    void useAppStore.getState().fetchUserServers(data.session.user.id);
    return null;
  },
  removeAccount: (accountId) => saveAccounts(accounts().filter((account) => account.id !== accountId)),
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      useAppStore.setState({ appUser: { id: 'signed_out', username: 'You', customStatus: '', presence: 'offline', avatarColor: '#7c5cfc' }, servers: [], channels: [], members: [], messagesByChannel: {}, activeServerId: null, activeChannelId: null, drafts: {}, onboarded: false });
      set({ user: null, guest: false, demoMode: !IS_SUPABASE_CONFIGURED });
    }
    return error;
  },
}));
