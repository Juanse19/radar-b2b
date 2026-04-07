// lib/db/supabase/admin.ts
// Service-role Supabase client — SERVER ONLY.
// This import ensures this module is NEVER bundled into client code.
import 'server-only';

import { createClient } from '@supabase/supabase-js';

const url    = process.env.SUPABASE_URL;
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.SUPABASE_DB_SCHEMA ?? 'matec_radar';

if (!url || !key) {
  throw new Error(
    'Supabase admin client: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.',
  );
}

// Singleton — shared across all route handler invocations in the same process.
export const adminDb = createClient(url, key, {
  db:   { schema },
  auth: { persistSession: false, autoRefreshToken: false },
});
