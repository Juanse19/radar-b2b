// app/admin/layout.tsx — Admin area guard
//
// Solo asegura que haya una sesión activa. La matriz de roles por subruta
// vive en lib/auth/permissions.ts y el middleware (proxy.ts) la aplica:
//   - /admin (raíz)   → ADMIN + COMERCIAL (dashboard global)
//   - /admin/usuarios, /admin/roles, /admin/lineas, /admin/empresas,
//     /admin/fuentes, /admin/configuracion, /admin/actividad,
//     /admin/api-keys, /admin/contactos-legacy, /admin/job-titles,
//     /admin/keywords, /admin/prompts, /admin/scoring, /admin/tokens
//                     → ADMIN-only (middleware redirige COMERCIAL a /sin-acceso)
//
// Las API routes en /api/admin/* siguen usando ensureAdmin() por su cuenta.
import { ensureSession } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureSession(); // redirige a /login si no hay sesión
  return <>{children}</>;
}
