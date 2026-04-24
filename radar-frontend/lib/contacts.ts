// lib/contacts.ts — SHIM
// Re-exports contact functions from the new db/ dispatcher.
// Kept for backwards compat with `import { ... } from '@/lib/contacts'`.

export {
  getContactos,
  getContactosCount,
  getContactosByEmpresa,
  crearContacto,
  importarContactos,
  actualizarHubSpotStatus,
  eliminarContacto,
} from './db/index';

// Legacy type alias
export type { ContactoRow } from './db/types';
export type { GetContactosFilter as GetContactosOptions } from './db/types';
