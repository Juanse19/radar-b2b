/**
 * Next.js edge middleware — lightweight auth guard for protected routes.
 *
 * Checks for the `matec_session` httpOnly cookie. If absent, redirects to
 * /login (page routes) or returns 401 (API routes).
 *
 * NOTE: This only checks cookie *presence*, not signature validity.
 *       Full session validation happens inside each route handler via
 *       getCurrentSession(). This layer prevents unauthenticated requests
 *       from ever reaching route handlers (saves cold-start costs).
 */
import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'matec_session';

// Paths that require authentication
const PROTECTED_API_PREFIXES = [
  '/api/radar-v2/',
  '/api/radar/',
  '/api/prospect',
  '/api/signals',
  '/api/admin',
];

const PROTECTED_PAGE_PREFIXES = [
  '/radar-v2/',
  '/scan',
  '/results',
  '/resultados-v2',
  '/schedule',
  '/contactos',
  '/calificacion',
  '/admin/',
  '/agente-resultados',
];

// Paths that are always public (login, static assets, Next internals)
const PUBLIC_EXACT = new Set(['/login', '/']);
const PUBLIC_PREFIXES = ['/_next/', '/favicon', '/api/auth/'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const isProtectedApi  = PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p));
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(p => pathname.startsWith(p));

  if (!isProtectedApi && !isProtectedPage) return NextResponse.next();

  const sessionCookie = req.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    if (isProtectedApi) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and Next internals.
     * The middleware function itself filters which paths require auth.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
