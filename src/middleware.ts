import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessTokenEdge } from '@/lib/auth/jwt-edge';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isApiAuthRoute = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/refresh'].includes(pathname);
  const isCronRoute = pathname.startsWith('/api/cron/');
  const isApiRoute = pathname.startsWith('/api/');

  // Public student attendance form pages — no auth required
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

  // TEMPORARY: Allow working seamlessly with or without login
  if (!token) {
    if (isAuthRoute) return NextResponse.next();

    const referer = request.headers.get('referer') || '';
    let routeRole: 'admin' | 'manager' | 'mentor' = 'manager';
    if (pathname.startsWith('/admin') || referer.includes('/admin')) routeRole = 'admin';
    else if (pathname.startsWith('/mentor') || referer.includes('/mentor')) routeRole = 'mentor';

    const fallbackUser = {
      id: `dev-${routeRole}`,
      email: `${routeRole}@programming-hero.com`,
      role: routeRole,
      name: `Dev ${routeRole.charAt(0).toUpperCase() + routeRole.slice(1)}`,
      team_role: 'manager',
    };

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', fallbackUser.id);
    requestHeaders.set('x-user-email', fallbackUser.email);
    requestHeaders.set('x-user-role', fallbackUser.role);
    requestHeaders.set('x-user-name', fallbackUser.name);
    requestHeaders.set('x-user-team-role', fallbackUser.team_role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  try {
    const payload = await verifyAccessTokenEdge(token);

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
    if (isAuthRoute) return NextResponse.next();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', 'dev-manager');
    requestHeaders.set('x-user-email', 'manager@programming-hero.com');
    requestHeaders.set('x-user-role', 'manager');
    requestHeaders.set('x-user-name', 'Dev Manager');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
}

export const config = {
  matcher: [
    '/((?!api/auth/login|api/auth/register|api/auth/logout|api/auth/refresh|cron|_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};
