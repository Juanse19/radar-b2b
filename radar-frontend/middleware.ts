import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccess } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/auth/types';

const SESSION_COOKIE = 'matec_session_pub'; // plain-JSON companion; matec_session is iron-session encrypted

const PUBLIC_PATHS = ['/login', '/sin-acceso', '/api/', '/_next/', '/favicon'];

function getSessionFromCookie(req: NextRequest): { role: UserRole } | null {
  const cookie = req.cookies.get(SESSION_COOKIE);
  if (!cookie?.value) return null;
  try {
    const parsed = JSON.parse(cookie.value) as { role?: unknown };
    const role = parsed?.role;
    if (role === 'ADMIN' || role === 'COMERCIAL' || role === 'AUXILIAR') {
      return { role };
    }
    return null;
  } catch {
    return null;
  }
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = getSessionFromCookie(req);

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
