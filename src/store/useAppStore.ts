import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Appearance, Theme } from '../theme/types';
import { DEFAULT_APPEARANCE } from '../theme/types';
import { DEFAULT_THEME_ID, PRESET_THEMES } from '../theme/presets';
import { hueFromString, inviteCode, uid } from '../lib/id';
import { deleteBlob } from '../lib/blobStore';
import { IS_SUPABASE_CONFIGURED, supabase } from '../supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Presence = 'online' | 'idle' | 'dnd' | 'offline';
export type ChannelType = 'TEXT' | 'VOICE' | 'DM';
export type AttachmentKind = 'image' | 'audio' | 'video' | 'file';

export interface Attachment {
  /** Key into the IndexedDB blob store, and the attachment's own identity. */
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
  width?: number;
  height?: number;
  /** Present when the file lives on a remote host instead of IndexedDB. */
  url?: string;
  /** Seconds. Voice notes and audio only. */
  duration?: number;
  /** Normalised 0–1 amplitude peaks, for drawing a voice note's waveform. */
  peaks?: number[];
  /** Ephemeral direct-transfer details. The sender keeps the original bytes. */
  p2p?: { fileId: string; senderPeerId: string };
}

export interface PollOption {
  id: string;
  label: string;
  /** User ids, so a voter can change their mind and see their own choice. */
  votes: string[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  multiple: boolean;
  closed: boolean;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  author_name?: string;
  author_color?: string;
  author_avatar?: Attachment;
  content: string;
  created_at: string;
  edited_at?: string;
  /** Id of the message this one replies to. */
  reply_to?: string;
  /**
   * Emoji to the user ids who reacted with it. Storing ids rather than a count
   * is what makes reactions toggleable and lets us highlight your own.
   */
  reactions?: Record<string, string[]>;
  attachments?: Attachment[];
  poll?: Poll;
  /** Channel notices — created, renamed, someone joined. Rendered inline. */
  system?: boolean;
}

export interface Server {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  icon_color?: string;
  description?: string;
  icon?: Attachment;
  banner?: Attachment;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  topic?: string;
}

export interface Member {
  id: string;
  username: string;
  presence: Presence;
  avatarColor: string;
  customStatus?: string;
}

export interface AppUser {
  id: string;
  username: string;
  customStatus: string;
  presence: Presence;
  avatarColor: string;
  /** Shown everywhere; the username stays the stable @handle. */
  displayName?: string;
  bio?: string;
  pronouns?: string;
  /** Two colours make the banner; one colour makes it flat. */
  bannerFrom?: string;
  bannerTo?: string;
  /** 'none' | 'sheen' | 'glow' | 'ring' */
  effect?: string;
  /** Original image bytes live in IndexedDB; this carries their display metadata. */
  avatar?: Attachment;
  banner?: Attachment;
}

export interface VoicePeer {
  id: string;
  username: string;
  avatarColor: string;
  speaking: boolean;
  muted: boolean;
}

export interface TypingEntry {
  username: string;
  /** Epoch ms. Entries older than a few seconds are treated as expired. */
  at: number;
}

export type ToastKind = 'info' | 'ok' | 'warn' | 'danger';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
}

export type RightPanel = 'members' | 'pinned' | 'saved' | 'none';

export interface LightboxState {
  attachments: Attachment[];
  index: number;
}

/** Which dialog is on screen. Only ever one, which keeps focus handling honest. */
export type DialogName =
  | 'settings'
  | 'profile'
  | 'themeStudio'
  | 'createServer'
  | 'createChannel'
  | 'joinServer'
  | 'shortcuts'
  | 'poll'
  | 'members'
  | 'newDm'
  | 'pinned'
  | 'saved'
  | null;

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

function defaultUser(): AppUser {
  const id = uid('u');
  return {
    id,
    username: 'You',
    customStatus: '',
    presence: 'online',
    avatarColor: `hsl(${hueFromString(id)} 55% 55%)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface AppState {
  /** False until persisted state has been read back. Gates the first paint. */
  hydrated: boolean;
  markHydrated: () => void;

  /** False until the user has chosen a name. Gates the app behind onboarding. */
  onboarded: boolean;
  completeOnboarding: (username: string, avatarColor: string) => void;

  // ── Identity ───────────────────────────────────────────────────────────────
  appUser: AppUser;
  setAppUser: (patch: Partial<AppUser>) => void;

  // ── Look and feel ──────────────────────────────────────────────────────────
  themeId: string;
  customThemes: Theme[];
  appearance: Appearance;
  setThemeId: (id: string) => void;
  saveCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
  renameCustomTheme: (id: string, name: string) => void;
  setAppearance: (patch: Partial<Appearance>) => void;

  // ── Preferences ────────────────────────────────────────────────────────────
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  sendOnEnter: boolean;
  setSendOnEnter: (v: boolean) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;

  // ── Navigation ─────────────────────────────────────────────────────────────
  activeServerId: string | null;
  activeChannelId: string | null;
  setActiveServerId: (id: string | null) => void;
  setActiveChannelId: (id: string | null) => void;
  /** Selects a channel and its server together — used by search and the palette. */
  jumpTo: (serverId: string, channelId: string) => void;

  // ── Servers and channels ───────────────────────────────────────────────────
  servers: Server[];
  channels: Channel[];
  members: Member[];
  createServer: (
    name: string,
    options: Pick<Server, 'icon_color' | 'description' | 'icon' | 'banner'>,
  ) => { server: Server; channel: Channel };
  deleteServer: (id: string) => void;
  renameServer: (id: string, name: string) => void;
  joinServerByCode: (code: string) => Server | null;
  createChannel: (name: string, type: ChannelType, topic?: string) => Channel | null;
  /** Opens (creating on first use) a one-to-one channel with a member. */
  openDm: (memberId: string, username: string) => void;
  /** Starts a private conversation without requiring a shared server. */
  openDmByUsername: (username: string) => string | null;
  deleteChannel: (id: string) => void;
  renameChannel: (id: string, name: string) => void;
  setChannelTopic: (id: string, topic: string) => void;
  setMembers: (members: Member[]) => void;
  fetchUserServers: (userId: string) => Promise<void>;
  clearAppState: () => void;

  // ── Messages ───────────────────────────────────────────────────────────────
  messagesByChannel: Record<string, Message[]>;
  addMessage: (message: Message) => void;
  /** Replaces a channel's history wholesale — used when a server sends it. */
  setChannelMessages: (channelId: string, messages: Message[]) => void;
  editMessage: (channelId: string, id: string, content: string) => void;
  deleteMessage: (channelId: string, id: string) => void;
  toggleReaction: (channelId: string, id: string, emoji: string) => void;
  votePoll: (channelId: string, messageId: string, optionId: string) => void;
  closePoll: (channelId: string, messageId: string) => void;

  // ── Composing ──────────────────────────────────────────────────────────────
  drafts: Record<string, string>;
  setDraft: (channelId: string, value: string) => void;
  replyingTo: Message | null;
  setReplyingTo: (message: Message | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  recentEmoji: string[];
  noteEmojiUse: (emoji: string) => void;

  // ── Reading state ──────────────────────────────────────────────────────────
  lastReadAt: Record<string, string>;
  markChannelRead: (channelId: string) => void;
  mutedChannelIds: string[];
  toggleChannelMute: (channelId: string) => void;

  // ── Keeping things ─────────────────────────────────────────────────────────
  pinnedByChannel: Record<string, string[]>;
  togglePin: (channelId: string, messageId: string) => void;
  savedIds: string[];
  toggleSaved: (messageId: string) => void;

  // ── Typing ─────────────────────────────────────────────────────────────────
  typingByChannel: Record<string, Record<string, TypingEntry>>;
  noteTyping: (channelId: string, userId: string, username: string) => void;
  clearTyping: (channelId: string, userId: string) => void;

  // ── Voice ──────────────────────────────────────────────────────────────────
  voiceChannelId: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  voicePeers: Record<string, VoicePeer>;
  voiceError: string | null;
  joinVoice: (channelId: string) => void;
  leaveVoice: () => void;
  setMuted: (v: boolean) => void;
  setDeafened: (v: boolean) => void;
  setVoicePeer: (peer: VoicePeer) => void;
  removeVoicePeer: (id: string) => void;
  setVoiceError: (message: string | null) => void;

  // ── Chrome ─────────────────────────────────────────────────────────────────
  dialog: DialogName;
  openDialog: (name: Exclude<DialogName, null>) => void;
  closeDialog: () => void;
  rightPanel: RightPanel;
  setRightPanel: (panel: RightPanel) => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  lightbox: LightboxState | null;
  setLightbox: (state: LightboxState | null) => void;

  // ── Toasts ─────────────────────────────────────────────────────────────────
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, detail?: string) => void;
  dismissToast: (id: string) => void;

  // ── Housekeeping ───────────────────────────────────────────────────────────
  /** Installs the demo workspace, but only when there is nothing to lose. */
  seedIfEmpty: () => void;
  /** First cloud sign-in gets guidance without creating a server. */
  ensureBeaconWelcome: () => void;
  /** Wipes everything and starts over. Settings › Data. */
  resetEverything: () => void;
}

const PERSIST_KEY = 'beacon-store-v2';

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),

      onboarded: false,
      completeOnboarding: (username, avatarColor) =>
        set((s) => ({
          onboarded: true,
          appUser: { ...s.appUser, username: username.trim() || 'You', avatarColor },
        })),

      // ── Identity ─────────────────────────────────────────────────────────────
      appUser: defaultUser(),
      setAppUser: (patch) => set((s) => ({ appUser: { ...s.appUser, ...patch } })),

      // ── Look and feel ────────────────────────────────────────────────────────
      themeId: DEFAULT_THEME_ID,
      customThemes: [],
      appearance: DEFAULT_APPEARANCE,
      setThemeId: (id) => set({ themeId: id }),
      saveCustomTheme: (theme) =>
        set((s) => {
          const existing = s.customThemes.findIndex((t) => t.id === theme.id);
          const customThemes =
            existing >= 0
              ? s.customThemes.map((t) => (t.id === theme.id ? theme : t))
              : [...s.customThemes, theme];
          return { customThemes, themeId: theme.id };
        }),
      deleteCustomTheme: (id) =>
        set((s) => ({
          customThemes: s.customThemes.filter((t) => t.id !== id),
          themeId: s.themeId === id ? DEFAULT_THEME_ID : s.themeId,
        })),
      renameCustomTheme: (id, name) =>
        set((s) => ({
          customThemes: s.customThemes.map((t) =>
            t.id === id ? { ...t, name: name.trim().slice(0, 40) || t.name } : t,
          ),
        })),
      setAppearance: (patch) => set((s) => ({ appearance: { ...s.appearance, ...patch } })),

      // ── Preferences ──────────────────────────────────────────────────────────
      soundEnabled: true,
      setSoundEnabled: (v) => set({ soundEnabled: v }),
      sendOnEnter: true,
      setSendOnEnter: (v) => set({ sendOnEnter: v }),
      showDeleteConfirm: true,
      setShowDeleteConfirm: (v) => set({ showDeleteConfirm: v }),

      // ── Navigation ───────────────────────────────────────────────────────────
      activeServerId: null,
      activeChannelId: null,
      setActiveServerId: (id) => {
        if (id === null) {
          set({ activeServerId: null, activeChannelId: null, replyingTo: null, editingId: null });
          return;
        }
        // Landing on a server should land you in a room, not an empty pane.
        const firstText = get().channels.find((c) => c.server_id === id && c.type === 'TEXT');
        set({
          activeServerId: id,
          activeChannelId: firstText?.id ?? null,
          replyingTo: null,
          editingId: null,
        });
      },
      setActiveChannelId: (id) => set({ activeChannelId: id, replyingTo: null, editingId: null }),
      jumpTo: (serverId, channelId) =>
        set({
          activeServerId: serverId,
          activeChannelId: channelId,
          replyingTo: null,
          editingId: null,
        }),

      // ── Servers and channels ─────────────────────────────────────────────────
      servers: [],
      channels: [],
      members: [],

      createServer: (name, options) => {
        const server: Server = {
          id: uid('s'),
          name: name.trim() || 'New server',
          invite_code: inviteCode(),
          owner_id: get().appUser.id,
          ...options,
        };
        const channel: Channel = {
          id: uid('c'),
          server_id: server.id,
          name: 'general',
          type: 'TEXT',
          topic: 'The first room. Rename it, or make more.',
        };
        set((s) => ({
          servers: [...s.servers, server],
          channels: [...s.channels, channel],
          activeServerId: server.id,
          activeChannelId: channel.id,
        }));
        if (IS_SUPABASE_CONFIGURED) {
          void (async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData.session?.user.id;
            if (!userId) return;
            const { data: remote, error } = await supabase
              .from('servers')
              .insert({ name: server.name, owner_id: userId, invite_code: server.invite_code, icon_color: server.icon_color, description: server.description })
              .select('*')
              .single();
            if (error || !remote) return;
            const remoteServer = remote as Server;
            const { error: memberError } = await supabase.from('server_members').insert({ server_id: remoteServer.id, user_id: userId, role: 'owner' });
            if (memberError) return;
            const { data: remoteChannel } = await supabase.from('channels').insert({ server_id: remoteServer.id, name: 'general', type: 'TEXT', topic: channel.topic }).select('*').single();
            if (!remoteChannel) return;
            const syncedChannel = remoteChannel as Channel;
            set((state) => ({
              servers: state.servers.map((item) => item.id === server.id ? remoteServer : item),
              channels: state.channels.map((item) => item.id === channel.id ? syncedChannel : item),
              activeServerId: state.activeServerId === server.id ? remoteServer.id : state.activeServerId,
              activeChannelId: state.activeChannelId === channel.id ? syncedChannel.id : state.activeChannelId,
            }));
          })();
        }
        return { server, channel };
      },

      deleteServer: (id) =>
        set((s) => {
          const doomed = s.channels.filter((c) => c.server_id === id).map((c) => c.id);
          const messagesByChannel = { ...s.messagesByChannel };
          for (const channelId of doomed) delete messagesByChannel[channelId];
          const remaining = s.servers.filter((x) => x.id !== id);
          const isActive = s.activeServerId === id;
          const nextServer = isActive ? (remaining[0]?.id ?? null) : s.activeServerId;
          const nextChannel = isActive
            ? (s.channels.find((c) => c.server_id === nextServer && c.type === 'TEXT')?.id ?? null)
            : s.activeChannelId;
          return {
            servers: remaining,
            channels: s.channels.filter((c) => c.server_id !== id),
            messagesByChannel,
            activeServerId: nextServer,
            activeChannelId: nextChannel,
          };
        }),

      renameServer: (id, name) =>
        set((s) => ({
          servers: s.servers.map((x) =>
            x.id === id ? { ...x, name: name.trim().slice(0, 60) || x.name } : x,
          ),
        })),

      joinServerByCode: (code) => {
        const wanted = code.trim().toUpperCase();
        const found = get().servers.find((s) => s.invite_code.toUpperCase() === wanted);
        if (!found) return null;
        get().setActiveServerId(found.id);
        return found;
      },

      openDm: (memberId, username) => {
        const id = 'dm_' + memberId;
        if (!get().channels.some((c) => c.id === id)) {
          set((st) => ({
            channels: [...st.channels, { id, server_id: '__dm', name: username, type: 'DM' as const }],
          }));
        }
        set({ activeChannelId: id, replyingTo: null, editingId: null });
      },

      openDmByUsername: (username) => {
        const handle = username.trim().replace(/^@/, '').replace(/\s+/g, '_').toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(handle)) return null;
        const memberId = `contact_${handle}`;
        get().openDm(memberId, handle);
        return handle;
      },

      createChannel: (name, type, topic) => {
        const serverId = get().activeServerId;
        if (!serverId) return null;
        const channel: Channel = {
          id: uid('c'),
          server_id: serverId,
          name:
            name
              .trim()
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9\-_]/g, '')
              .slice(0, 40) || 'channel',
          type,
          topic: topic?.trim() || undefined,
        };
        set((s) => ({ channels: [...s.channels, channel] }));
        if (type === 'TEXT') set({ activeChannelId: channel.id });
        return channel;
      },

      deleteChannel: (id) =>
        set((s) => {
          const messagesByChannel = { ...s.messagesByChannel };
          delete messagesByChannel[id];
          const channels = s.channels.filter((c) => c.id !== id);
          const wasActive = s.activeChannelId === id;
          const fallback = channels.find(
            (c) => c.server_id === s.activeServerId && c.type === 'TEXT',
          );
          return {
            channels,
            messagesByChannel,
            activeChannelId: wasActive ? (fallback?.id ?? null) : s.activeChannelId,
            voiceChannelId: s.voiceChannelId === id ? null : s.voiceChannelId,
          };
        }),

      renameChannel: (id, name) =>
        set((s) => ({
          channels: s.channels.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name:
                    name
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      .replace(/[^a-z0-9\-_]/g, '')
                      .slice(0, 40) || c.name,
                }
              : c,
          ),
        })),

      setChannelTopic: (id, topic) =>
        set((s) => ({
          channels: s.channels.map((c) =>
            c.id === id ? { ...c, topic: topic.trim().slice(0, 200) || undefined } : c,
          ),
        })),

      setMembers: (members) => set({ members }),
      clearAppState: () => set({ servers: [], channels: [], members: [], messagesByChannel: {}, activeServerId: null, activeChannelId: null, drafts: {} }),
      fetchUserServers: async (userId) => {
        if (!IS_SUPABASE_CONFIGURED) return;
        const { data, error } = await supabase.from('server_members').select('server_id, servers(*)').eq('user_id', userId);
        if (error) return;
        const servers = (data ?? []).map((row) => {
          const related = (row as unknown as { servers?: Server | Server[] }).servers;
          return Array.isArray(related) ? related[0] : related;
        }).filter((server): server is Server => Boolean(server));
        const ids = servers.map((server) => server.id);
        const { data: channelData } = ids.length ? await supabase.from('channels').select('*').in('server_id', ids) : { data: [] };
        const channels = (channelData ?? []) as Channel[];
        set({ servers, channels, activeServerId: servers[0]?.id ?? null, activeChannelId: channels.find((channel) => channel.server_id === servers[0]?.id && channel.type === 'TEXT')?.id ?? null });
      },

      // ── Messages ─────────────────────────────────────────────────────────────
      messagesByChannel: {},

      addMessage: (message) =>
        set((s) => {
          const existing = s.messagesByChannel[message.channel_id] ?? [];
          // Realtime echoes the message we already inserted optimistically.
          if (existing.some((m) => m.id === message.id)) return s;
          return {
            messagesByChannel: {
              ...s.messagesByChannel,
              [message.channel_id]: [...existing, message],
            },
          };
        }),

      setChannelMessages: (channelId, messages) =>
        set((s) => ({
          messagesByChannel: { ...s.messagesByChannel, [channelId]: messages },
        })),

      editMessage: (channelId, id, content) =>
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
              m.id === id ? { ...m, content, edited_at: new Date().toISOString() } : m,
            ),
          },
        })),

      deleteMessage: (channelId, id) => {
        const message = (get().messagesByChannel[channelId] ?? []).find((m) => m.id === id);
        // Drop the bytes too, or IndexedDB grows forever behind the user's back.
        for (const attachment of message?.attachments ?? []) {
          if (!attachment.url) void deleteBlob(attachment.id);
        }
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).filter((m) => m.id !== id),
          },
          pinnedByChannel: {
            ...s.pinnedByChannel,
            [channelId]: (s.pinnedByChannel[channelId] ?? []).filter((x) => x !== id),
          },
          savedIds: s.savedIds.filter((x) => x !== id),
        }));
      },

      toggleReaction: (channelId, id, emoji) => {
        const me = get().appUser.id;
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) => {
              if (m.id !== id) return m;
              const reactions = { ...(m.reactions ?? {}) };
              const voters = reactions[emoji] ?? [];
              const next = voters.includes(me)
                ? voters.filter((v) => v !== me)
                : [...voters, me];
              if (next.length === 0) delete reactions[emoji];
              else reactions[emoji] = next;
              return { ...m, reactions };
            }),
          },
        }));
      },

      votePoll: (channelId, messageId, optionId) => {
        const me = get().appUser.id;
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) => {
              if (m.id !== messageId || !m.poll || m.poll.closed) return m;
              const { multiple } = m.poll;
              const options = m.poll.options.map((option) => {
                const has = option.votes.includes(me);
                if (option.id === optionId) {
                  return {
                    ...option,
                    votes: has ? option.votes.filter((v) => v !== me) : [...option.votes, me],
                  };
                }
                // Single-choice polls move your vote instead of stacking it.
                if (!multiple && has) {
                  return { ...option, votes: option.votes.filter((v) => v !== me) };
                }
                return option;
              });
              return { ...m, poll: { ...m.poll, options } };
            }),
          },
        }));
      },

      closePoll: (channelId, messageId) =>
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: (s.messagesByChannel[channelId] ?? []).map((m) =>
              m.id === messageId && m.poll ? { ...m, poll: { ...m.poll, closed: true } } : m,
            ),
          },
        })),

      // ── Composing ────────────────────────────────────────────────────────────
      drafts: {},
      setDraft: (channelId, value) =>
        set((s) => {
          const drafts = { ...s.drafts };
          if (value) drafts[channelId] = value;
          else delete drafts[channelId];
          return { drafts };
        }),
      replyingTo: null,
      setReplyingTo: (message) => set({ replyingTo: message, editingId: null }),
      editingId: null,
      setEditingId: (id) => set({ editingId: id, replyingTo: null }),
      recentEmoji: ['👍', '❤️', '😂', '🎉', '👀', '🔥'],
      noteEmojiUse: (emoji) =>
        set((s) => ({
          recentEmoji: [emoji, ...s.recentEmoji.filter((e) => e !== emoji)].slice(0, 24),
        })),

      // ── Reading state ────────────────────────────────────────────────────────
      lastReadAt: {},
      markChannelRead: (channelId) =>
        set((s) => ({
          lastReadAt: { ...s.lastReadAt, [channelId]: new Date().toISOString() },
        })),
      mutedChannelIds: [],
      toggleChannelMute: (channelId) =>
        set((s) => ({
          mutedChannelIds: s.mutedChannelIds.includes(channelId)
            ? s.mutedChannelIds.filter((x) => x !== channelId)
            : [...s.mutedChannelIds, channelId],
        })),

      // ── Keeping things ───────────────────────────────────────────────────────
      pinnedByChannel: {},
      togglePin: (channelId, messageId) =>
        set((s) => {
          const current = s.pinnedByChannel[channelId] ?? [];
          return {
            pinnedByChannel: {
              ...s.pinnedByChannel,
              [channelId]: current.includes(messageId)
                ? current.filter((x) => x !== messageId)
                : [...current, messageId],
            },
          };
        }),
      savedIds: [],
      toggleSaved: (messageId) =>
        set((s) => ({
          savedIds: s.savedIds.includes(messageId)
            ? s.savedIds.filter((x) => x !== messageId)
            : [messageId, ...s.savedIds],
        })),

      // ── Typing ───────────────────────────────────────────────────────────────
      typingByChannel: {},
      noteTyping: (channelId, userId, username) =>
        set((s) => ({
          typingByChannel: {
            ...s.typingByChannel,
            [channelId]: {
              ...(s.typingByChannel[channelId] ?? {}),
              [userId]: { username, at: Date.now() },
            },
          },
        })),
      clearTyping: (channelId, userId) =>
        set((s) => {
          const channel = { ...(s.typingByChannel[channelId] ?? {}) };
          delete channel[userId];
          return { typingByChannel: { ...s.typingByChannel, [channelId]: channel } };
        }),

      // ── Voice ────────────────────────────────────────────────────────────────
      voiceChannelId: null,
      isMuted: false,
      isDeafened: false,
      voicePeers: {},
      voiceError: null,
      joinVoice: (channelId) => set({ voiceChannelId: channelId, voiceError: null }),
      leaveVoice: () => set({ voiceChannelId: null, voicePeers: {}, voiceError: null }),
      setMuted: (v) => set({ isMuted: v }),
      setDeafened: (v) =>
        // Deafening implies muting: you cannot be heard while you cannot hear.
        set((s) => ({ isDeafened: v, isMuted: v ? true : s.isMuted })),
      setVoicePeer: (peer) =>
        set((s) => ({ voicePeers: { ...s.voicePeers, [peer.id]: peer } })),
      removeVoicePeer: (id) =>
        set((s) => {
          const voicePeers = { ...s.voicePeers };
          delete voicePeers[id];
          return { voicePeers };
        }),
      setVoiceError: (message) => set({ voiceError: message }),

      // ── Chrome ───────────────────────────────────────────────────────────────
      dialog: null,
      openDialog: (name) => set({ dialog: name }),
      closeDialog: () => set({ dialog: null }),
      rightPanel: 'members',
      setRightPanel: (panel) => set({ rightPanel: panel }),
      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),
      searchOpen: false,
      setSearchOpen: (v) => set({ searchOpen: v }),
      lightbox: null,
      setLightbox: (state) => set({ lightbox: state }),

      // ── Toasts ───────────────────────────────────────────────────────────────
      toasts: [],
      toast: (kind, title, detail) =>
        set((s) => ({ toasts: [...s.toasts, { id: uid('t'), kind, title, detail }] })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ── Housekeeping ─────────────────────────────────────────────────────────
      seedIfEmpty: () => {
        if (get().servers.length > 0) return;
        const seeded = buildDemoWorkspace(get().appUser);
        set({
          servers: seeded.servers,
          channels: seeded.channels,
          members: seeded.members,
          messagesByChannel: seeded.messagesByChannel,
          activeServerId: seeded.servers[0].id,
          activeChannelId: seeded.channels[0].id,
        });
      },

      ensureBeaconWelcome: () => {
        if (get().servers.length > 0 || get().channels.some((channel) => channel.id === 'dm_beacon')) return;
        const channel: Channel = { id: 'dm_beacon', server_id: '__dm', name: 'beacon', type: 'DM' };
        const message: Message = {
          id: 'beacon_welcome', channel_id: channel.id, author_id: 'beacon', author_name: 'Beacon', author_color: '#7c5cfc',
          content: 'Welcome to Beacon. Create or join a server when you are ready. Files over 5 MB transfer directly between peers without compression. Use Ctrl K to navigate and Ctrl , for settings.',
          created_at: new Date().toISOString(),
        };
        set((state) => ({ channels: [...state.channels, channel], messagesByChannel: { ...state.messagesByChannel, [channel.id]: [message] }, activeServerId: null, activeChannelId: channel.id }));
      },

      resetEverything: () => {
        set({
          servers: [],
          channels: [],
          members: [],
          messagesByChannel: {},
          drafts: {},
          lastReadAt: {},
          pinnedByChannel: {},
          savedIds: [],
          mutedChannelIds: [],
          customThemes: [],
          themeId: DEFAULT_THEME_ID,
          appearance: DEFAULT_APPEARANCE,
          activeServerId: null,
          activeChannelId: null,
          onboarded: false,
          appUser: defaultUser(),
        });
      },
    }),
    {
      // v2: the shape changed substantially from the original store, so this uses
      // a fresh key rather than trying to migrate 'beacon-minimal-storage'.
      name: PERSIST_KEY,
      partialize: (state) => ({
        onboarded: state.onboarded,
        appUser: state.appUser,
        themeId: state.themeId,
        customThemes: state.customThemes,
        appearance: state.appearance,
        soundEnabled: state.soundEnabled,
        sendOnEnter: state.sendOnEnter,
        showDeleteConfirm: state.showDeleteConfirm,
        servers: state.servers,
        channels: state.channels,
        members: state.members,
        messagesByChannel: state.messagesByChannel,
        drafts: state.drafts,
        lastReadAt: state.lastReadAt,
        pinnedByChannel: state.pinnedByChannel,
        savedIds: state.savedIds,
        mutedChannelIds: state.mutedChannelIds,
        recentEmoji: state.recentEmoji,
        activeServerId: state.activeServerId,
        activeChannelId: state.activeChannelId,
        rightPanel: state.rightPanel,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('[Beacon] Could not read saved data:', error);
        state?.markHydrated();
      },
    },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// Selectors
//
// Kept as plain functions rather than hooks so panels, search and the command
// palette can all ask the same questions without duplicating the logic.
//
// Anything that returns a list must return a *stable* reference when empty —
// a fresh `[]` on every read makes useSyncExternalStore re-render forever.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared empty results, so a miss never allocates a new array. */
export const EMPTY_MESSAGES: Message[] = [];
export const EMPTY_IDS: string[] = [];

export function channelMessages(state: AppState, channelId: string | null): Message[] {
  if (!channelId) return EMPTY_MESSAGES;
  return state.messagesByChannel[channelId] ?? EMPTY_MESSAGES;
}

export function unreadCount(state: AppState, channelId: string): number {
  const since = state.lastReadAt[channelId];
  const messages = state.messagesByChannel[channelId] ?? [];
  const me = state.appUser.id;
  if (!since) return messages.filter((m) => m.author_id !== me && !m.system).length;
  const cutoff = new Date(since).getTime();
  return messages.filter(
    (m) => m.author_id !== me && !m.system && new Date(m.created_at).getTime() > cutoff,
  ).length;
}

/** Timestamp of the first unread message, for the "New messages" divider. */
export function firstUnreadAt(state: AppState, channelId: string): string | null {
  const since = state.lastReadAt[channelId];
  if (!since) return null;
  const cutoff = new Date(since).getTime();
  const me = state.appUser.id;
  const found = (state.messagesByChannel[channelId] ?? []).find(
    (m) => m.author_id !== me && !m.system && new Date(m.created_at).getTime() > cutoff,
  );
  return found?.created_at ?? null;
}

export function findMessage(state: AppState, id: string): Message | undefined {
  for (const list of Object.values(state.messagesByChannel)) {
    const found = list.find((m) => m.id === id);
    if (found) return found;
  }
  return undefined;
}

export function allThemes(state: AppState): Theme[] {
  return [...PRESET_THEMES, ...state.customThemes];
}

export function activeTheme(state: AppState): Theme {
  return (
    allThemes(state).find((t) => t.id === state.themeId) ??
    PRESET_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ??
    PRESET_THEMES[0]
  );
}

/** Everyone in the workspace, you first, deduplicated. */
export function roster(state: Pick<AppState, 'appUser' | 'members'>): Member[] {
  const me: Member = {
    id: state.appUser.id,
    username: state.appUser.username,
    presence: state.appUser.presence,
    avatarColor: state.appUser.avatarColor,
    customStatus: state.appUser.customStatus || undefined,
  };
  return [me, ...state.members.filter((m) => m.id !== state.appUser.id)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo workspace
//
// Installed once, only into an empty app. The copy does double duty: it shows
// what Beacon can render (markdown, code, a poll, replies, reactions) without a
// tour, and it gives a brand-new user something to react to.
// ─────────────────────────────────────────────────────────────────────────────

function buildDemoWorkspace(me: AppUser): {
  servers: Server[];
  channels: Channel[];
  members: Member[];
  messagesByChannel: Record<string, Message[]>;
} {
  const serverId = uid('s');
  const general = uid('c');
  const design = uid('c');
  const voice = uid('c');

  const servers: Server[] = [
    {
      id: serverId,
      name: 'Beacon HQ',
      invite_code: inviteCode(),
      owner_id: me.id,
      icon_color: '#8b8b95',
    },
  ];

  const channels: Channel[] = [
    { id: general, server_id: serverId, name: 'general', type: 'TEXT', topic: 'Anything goes.' },
    {
      id: design,
      server_id: serverId,
      name: 'design',
      type: 'TEXT',
      topic: 'Themes, type and pixels.',
    },
    { id: voice, server_id: serverId, name: 'Lounge', type: 'VOICE' },
  ];

  const nova: Member = {
    id: 'demo_nova',
    username: 'Nova',
    presence: 'online',
    avatarColor: '#7fb79b',
    customStatus: 'Building themes',
  };
  const wren: Member = {
    id: 'demo_wren',
    username: 'Wren',
    presence: 'idle',
    avatarColor: '#c89b5c',
    customStatus: 'Back in ten',
  };
  const kit: Member = {
    id: 'demo_kit',
    username: 'Kit',
    presence: 'dnd',
    avatarColor: '#9b7bf7',
  };
  const members = [nova, wren, kit];

  const t = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

  const welcomeId = uid('m');
  const themeId = uid('m');

  const messagesByChannel: Record<string, Message[]> = {
    [general]: [
      {
        id: uid('m'),
        channel_id: general,
        author_id: 'system',
        content: 'Nova created this channel.',
        created_at: t(240),
        system: true,
      },
      {
        id: welcomeId,
        channel_id: general,
        author_id: nova.id,
        author_name: nova.username,
        author_color: nova.avatarColor,
        content:
          "Welcome to Beacon. It's free, it runs on your machine, and it keeps working with no server attached.\n\nThe part worth trying first: **⌘K**. Everything in the app is reachable from there.",
        created_at: t(238),
        reactions: { '👋': [wren.id, kit.id], '🔥': [kit.id] },
      },
      {
        id: uid('m'),
        channel_id: general,
        author_id: wren.id,
        author_name: wren.username,
        author_color: wren.avatarColor,
        content: 'Messages render real markdown, which I did not expect:\n\n- `inline code`\n- **bold** and *italic*\n- > quotes\n- ||spoilers||',
        created_at: t(212),
      },
      {
        id: uid('m'),
        channel_id: general,
        author_id: kit.id,
        author_name: kit.username,
        author_color: kit.avatarColor,
        content: 'Code blocks keep their shape too:\n\n```\nconst theme = deriveThemeFromAccent("#7fb79b", "dark")\n// one colour in, a whole palette out\n```',
        created_at: t(208),
        reactions: { '👀': [nova.id] },
      },
      {
        id: uid('m'),
        channel_id: general,
        author_id: nova.id,
        author_name: nova.username,
        author_color: nova.avatarColor,
        content: 'Replies keep their thread, so you can follow who answered what.',
        created_at: t(96),
        reply_to: welcomeId,
      },
      {
        id: uid('m'),
        channel_id: general,
        author_id: wren.id,
        author_name: wren.username,
        author_color: wren.avatarColor,
        content: 'Which theme should we ship as the default?',
        created_at: t(44),
        poll: {
          question: 'Which theme should we ship as the default?',
          multiple: false,
          closed: false,
          options: [
            { id: 'o1', label: 'Obsidian — no colour at all', votes: [nova.id, kit.id] },
            { id: 'o2', label: 'Ink — warm charcoal and brass', votes: [wren.id] },
            { id: 'o3', label: 'Slate — quiet grey-green', votes: [] },
          ],
        },
      },
    ],
    [design]: [
      {
        id: themeId,
        channel_id: design,
        author_id: nova.id,
        author_name: nova.username,
        author_color: nova.avatarColor,
        content:
          'Eight themes ship in the box, and the Studio builds the rest. Give it one colour and it derives the whole palette — the greys get pulled a few degrees toward your hue so it reads as one material.',
        created_at: t(180),
        reactions: { '🎨': [wren.id, kit.id] },
      },
      {
        id: uid('m'),
        channel_id: design,
        author_id: kit.id,
        author_name: kit.username,
        author_color: kit.avatarColor,
        content:
          'Themes travel as a code, so sharing one needs no account:\n\n`beacon1:…` → paste it into the Studio and it lands.',
        created_at: t(174),
      },
      {
        id: uid('m'),
        channel_id: design,
        author_id: wren.id,
        author_name: wren.username,
        author_color: wren.avatarColor,
        content: 'It checks contrast as you edit, which stopped me shipping unreadable grey on grey.',
        created_at: t(60),
        reply_to: themeId,
      },
    ],
  };

  return { servers, channels, members, messagesByChannel };
}
