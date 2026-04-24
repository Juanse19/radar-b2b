// GET /api/session-pub
//
// Migration helper: reads the httpOnly matec_session cookie server-side,
// calls setAppSession() to ensure matec_session_pub (non-httpOnly) exists,
// and returns the session JSON for AppShellLoader to display the sidebar.
//
// Called once on page load by AppShellLoader when matec_session_pub is absent
// (e.g. sessions created before the companion-cookie fix was deployed).

import { NextResponse } from 'next/server';
import { getCurrentSession, setAppSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json(null, { status: 401 });

  // Ensure the non-httpOnly companion cookie is written for this session.
  await setAppSession(session);

  return NextResponse.json(session);
}
