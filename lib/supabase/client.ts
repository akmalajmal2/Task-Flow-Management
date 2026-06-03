'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Singleton browser client. The same instance is reused across renders so
 * the auth subscription doesn't get recreated and realtime channels can
 * survive React Strict Mode double-mount.
 */
export function createClient() {
  if (_client) return _client;
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _client;
}
