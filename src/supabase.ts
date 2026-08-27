import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CONFIGURATION
// Set your Supabase credentials here or via environment variables in .env:
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key
// ============================================================================
const runtimeValue = (key: string): string => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key)?.trim() || '';
};

export const SUPABASE_URL = runtimeValue('beacon_custom_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = runtimeValue('beacon_custom_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Validates if the given string is a valid HTTP/HTTPS URL and not a dummy placeholder
 */
function isValidUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  if (urlString.includes('your_supabase_url_here') || urlString.includes('placeholder')) return false;
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates if the key is non-empty and not a placeholder
 */
function isValidKey(keyString: string): boolean {
  if (!keyString || typeof keyString !== 'string') return false;
  if (keyString.includes('your_supabase_anon_key_here') || keyString.includes('placeholder')) return false;
  return keyString.trim().length > 0;
}

export const IS_SUPABASE_CONFIGURED = isValidUrl(SUPABASE_URL) && isValidKey(SUPABASE_ANON_KEY);
export const isConfigured = IS_SUPABASE_CONFIGURED;

/**
 * Robust mock client to prevent application crashes when Supabase is unconfigured
 */
function createMockClient() {
  const mockQueryBuilder: any = {
    select: () => mockQueryBuilder,
    insert: () => mockQueryBuilder,
    update: () => mockQueryBuilder,
    delete: () => mockQueryBuilder,
    eq: () => mockQueryBuilder,
    neq: () => mockQueryBuilder,
    order: () => mockQueryBuilder,
    limit: () => mockQueryBuilder,
    single: () => Promise.resolve({ data: null, error: null }),
    then: (onfulfilled?: (value: any) => any) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
  };

  const mockChannel = {
    on: () => mockChannel,
    subscribe: () => mockChannel,
    unsubscribe: () => {},
  };

  return {
    from: () => mockQueryBuilder,
    channel: () => mockChannel,
    removeChannel: () => {},
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
    },
  } as unknown as ReturnType<typeof createClient>;
}

function initSupabase() {
  if (IS_SUPABASE_CONFIGURED) {
    try {
      return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
      console.warn('⚠️ [Beacon] Failed to initialize Supabase client:', err);
      return createMockClient();
    }
  }
  return createMockClient();
}

export const supabase = initSupabase();
