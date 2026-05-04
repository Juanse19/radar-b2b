import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { canAccess } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';

// Reads and cryptographically verifies the signed iron-session cookie.
// Uses unsealData (iron-session v8) — works in both Node.js and edge runtimes.
const SESSION_COOKIE = 'matec_session';

const PUBLIC_PATHS = ['/login', '/sin-acceso', '/api/', '/_next/', '/favicon'];

interface AppSessionData {
  user?: { role?: string };
}

async function getSessionFromCookie(req: NextRequest): Promise<{ role: UserRole } | null> {
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (!cookie?.value) return null;

  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) return null;

  try {
    const data = await unsealData<AppSessionData>(cookie.value, { password });
    const role = data?.user?.role;
    if (role === 'ADMIN' || role === 'COMERCIAL' || role === 'AUXILIAR') {
      return { role };
    }
    return null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await getSessionFromCookie(req);

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL('/sin-acceso', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
