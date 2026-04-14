// app/profile/page.tsx
// Sprint 3.6 Phase 2 — User profile page
//
// Server Component: fetches session and enriches with avatar_url from DB.
// Delegates all interactive behaviour to ProfileClient.
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';
import { ProfileClient } from './ProfileClient';

interface UsuarioRow {
  nombre: string;
  email: string;
  rol: string;
  avatar_url: string | null;
  created_at: string;
}

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  // Fetch the full row so we can surface avatar_url and created_at
  const db = getAdminDb();
  const { data } = await db
    .from('usuarios')
    .select('nombre, email, rol, avatar_url, created_at')
    .eq('id', session.id)
    .maybeSingle<UsuarioRow>();

  return (
    <ProfileClient
      userId={session.id}
      nombre={data?.nombre ?? session.name}
      email={data?.email ?? session.email}
      rol={(data?.rol ?? session.role) as 'ADMIN' | 'COMERCIAL' | 'AUXILIAR'}
      avatarUrl={data?.avatar_url ?? null}
      createdAt={data?.created_at ?? null}
    />
  );
}
