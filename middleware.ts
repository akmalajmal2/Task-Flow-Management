import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/workspaces',
  '/account',
  '/notifications',
  '/invitations',
];
const AUTH_ONLY_PREFIXES = ['/login', '/signup', '/reset-password'];

// FIX: /invite/[token] should be publicly accessible — unauthenticated users
// clicking an invite link land here, create an account, then accept.
// Previously it was implicitly unprotected but never explicitly considered.
// We do NOT add it to PROTECTED_PREFIXES.

export async function middleware(req: NextRequest) {
  const { response, user } = await updateSession(req);
  const { pathname } = req.nextUrl;

  // Logged out + protected route → /login?next=…
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Logged in + auth-only route → /dashboard
  if (user && AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
