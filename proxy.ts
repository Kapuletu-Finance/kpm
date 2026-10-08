import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const AUTH_ROUTES = ['/login', '/signup', '/accept-invite', '/forgot-password', '/reset-password'];

// Reads the session from the signed JWT cookie: no database or network call per request.
export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isSignedIn = !!request.auth?.user;

  // API routes enforce auth themselves and answer with 401 JSON, not redirects
  if (!isSignedIn && !isAuthRoute && !pathname.startsWith('/api/') && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  // Signed-in users skip the auth screens (invite/reset links still work while signed in)
  if (isSignedIn && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/workspace', request.nextUrl));
  }

  return NextResponse.next();
});

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
