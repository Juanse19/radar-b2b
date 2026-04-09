// lib/db/supabase/senales.ts
// Legacy compat shim — re-exports from radar_scans.ts.
// The 'senales' table is replaced by 'radar_scans' in the new schema.
import 'server-only';
export {
  getSenales,
  crearSenal,
  getSenalesSlim,
  countSenalesOroHoy,
} from './radar_scans';
