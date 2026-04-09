// lib/db/driver.ts
// Reads DB_DRIVER env var and returns the active database driver.
// Memoized per process (env vars don't change at runtime).

export type DbDriver = 'prisma' | 'supabase';

let _driver: DbDriver | null = null;

export function getDriver(): DbDriver {
  if (_driver) return _driver;
  const val = process.env.DB_DRIVER;
  _driver = val === 'supabase' ? 'supabase' : 'prisma';
  return _driver;
}
