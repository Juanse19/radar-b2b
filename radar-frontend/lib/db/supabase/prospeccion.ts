// lib/db/supabase/prospeccion.ts
// Legacy compat shim — re-exports from prospecciones.ts.
// The 'prospeccion_logs' table is replaced by 'prospecciones' in the new schema.
import 'server-only';
export {
  crearProspeccionLogs,
  getProspeccionLogs,
  actualizarProspeccionLog,
} from './prospecciones';
