import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
let _initPromise: Promise<SupabaseClient> | null = null;

async function initClient(): Promise<SupabaseClient> {
  if (_client) return _client;

  const res = await fetch('/api/public-config');
  if (!res.ok) throw new Error('Failed to load Supabase configuration');
  const { supabaseUrl, supabaseAnonKey } = await res.json();

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'wt-canvas-auth',
    },
  });

  return _client;
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!_initPromise) {
    _initPromise = initClient();
  }
  return _initPromise;
}

export function getSupabaseSync(): SupabaseClient | null {
  return _client;
}

export function getSessionTokenSync(): string | null {
  try {
    const raw = localStorage.getItem('wt-canvas-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch {
    return null;
  }
}
