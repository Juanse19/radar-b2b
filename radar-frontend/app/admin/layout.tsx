// app/admin/layout.tsx — Admin area guard
// Any request to /admin/* that passes middleware still goes through ensureAdmin()
// here for a server-side double-check.
import { ensureAdmin } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureAdmin(); // redirects to /sin-acceso if not ADMIN
  return <>{children}</>;
}
