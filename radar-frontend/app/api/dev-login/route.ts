// GET /api/dev-login
// DEV-ONLY: sets the httpOnly matec_session cookie directly for preview testing.
// Returns 404 in production.

import { NextResponse } from 'next/server';
import { setAppSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await setAppSession({
    id: 'dev-user-001',
    name: 'Demo Admin',
    email: 'demo@matec.com',
    role: 'ADMIN',
    accessState: 'ACTIVO',
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
