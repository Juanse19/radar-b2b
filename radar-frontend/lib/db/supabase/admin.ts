// lib/db/supabase/admin.ts
// Service-role Supabase client — SERVER ONLY.
import 'server-only';

import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createClient<any, any, any>>;

let _client: AnyClient | null = null;

export function getAdminDb(): AnyClient {
  if (_client) return _client;

  const url    = process.env.SUPABASE_URL;
  const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schema = process.env.SUPABASE_DB_SCHEMA ?? 'public';

  if (!url || !key) {
    throw new Error(
      'Supabase admin client: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local',
    );
  }

  _client = createClient(url, key, {
    db:   { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}

// Proxy so callers can write `adminDb.from(...)` without calling getAdminDb() explicitly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminDb: AnyClient = new Proxy({} as AnyClient, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getAdminDb() as any)[prop];
  },
});
