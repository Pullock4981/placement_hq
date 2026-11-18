import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessTokenEdge } from '@/lib/auth/jwt-edge';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isApiAuthRoute = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/refresh'].includes(pathname);
  const isCronRoute = pathname.startsWith('/api/cron/');
  const isApiRoute = pathname.startsWith('/api/');

  // Public student attendance form pages & followups — no auth required
  const isPublicAttendRoute = pathname.startsWith('/attend/');
  const isPublicAttendApi = pathname.startsWith('/api/attend/');
  const isPublicFollowupRoute = pathname.startsWith('/placement-followup/');
  const isPublicFollowupApi = pathname.startsWith('/api/placement-followup/');

  if (!isApiRoute) {
    if (isPublicAttendRoute || isPublicFollowupRoute) return NextResponse.next();
  } else {
    if (isApiAuthRoute || isCronRoute || isPublicAttendApi || isPublicFollowupApi) {
      return NextResponse.next();
    }
  }

  const token = request.cookies.get('access_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

  // 1. If NO token is present (Unauthenticated)
  if (!token) {
    // If accessing login/register, allow it
    if (isAuthRoute) return NextResponse.next();

    // If an API route is requested without auth, return 401
    if (isApiRoute) {
      return NextResponse.json(
        { message: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // For any protected page, strictly redirect to /login
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. If token IS present, verify signature and expiry
  try {
    const payload = await verifyAccessTokenEdge(token);

    // If already logged in and visiting /login or /register, redirect to dashboard
    if (isAuthRoute) {
      const redirectPath =
        payload.role === 'admin'
          ? '/admin'
          : payload.role === 'manager'
          ? '/manager'
          : '/mentor';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Role-based access control (RBAC)
    if (pathname.startsWith('/admin') && payload.role !== 'admin') {
      const redirectPath = payload.role === 'manager' ? '/manager' : '/mentor';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    if (pathname.startsWith('/manager') && payload.role !== 'manager' && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/mentor', request.url));
    }

    // Inject verified user headers into request
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.id);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', payload.name);
    if (payload.team_role) requestHeaders.set('x-user-team-role', payload.team_role);
    if (payload.team_nickname) requestHeaders.set('x-user-team-nickname', payload.team_nickname);
    if (payload.discord_username) requestHeaders.set('x-user-discord-username', payload.discord_username);
    if (payload.discord_user_id) requestHeaders.set('x-user-discord-user-id', payload.discord_user_id);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // Token is invalid or expired
    if (isApiRoute) {
      return NextResponse.json(
        { message: 'Session expired or invalid. Please log in again.' },
        { status: 401 }
      );
    }

    // Clear stale cookie and redirect to login
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('access_token');
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!api/auth/login|api/auth/register|api/auth/logout|api/auth/refresh|cron|_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
