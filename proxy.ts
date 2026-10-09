import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const AUTH_ROUTES = ['/login', '/signup', '/accept-invite', '/forgot-password', '/reset-password'];
const SECURE_COOKIE = '__Secure-authjs.session-token';

// Verifies the session JWT read-only. Wrapping this in Auth.js's `auth()` would re-issue
// the session cookie on every request, and a prefetch response arriving after logout
// would then bring the session back. No database or network call happens here.
async function isSignedIn(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // HTTPS deployments use the __Secure- cookie; local http uses the plain name.
    secureCookie: request.cookies.has(SECURE_COOKIE),
  });
  return !!token?.sub;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // API routes enforce auth themselves and answer with 401 JSON, not redirects
  if (pathname.startsWith('/api/') || pathname === '/') return NextResponse.next();

  const signedIn = await isSignedIn(request);

  if (!signedIn && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // Signed-in users skip the auth screens (invite/reset links still work while signed in)
  if (signedIn && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/workspace', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public images)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
