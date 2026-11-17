import { NextResponse } from 'next/server';
import { GOOGLE_OAUTH_SESSION_COOKIE, GOOGLE_OAUTH_STATE_COOKIE, googleOAuthCookieOptions } from '@/lib/google-oauth/session';
import { isSecureRequest } from '@/lib/auth/cookie-options';

export async function POST(request: Request) {
  const response = NextResponse.json({ message: 'Logged out' });
  const secure = isSecureRequest(request);

  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 0,
  });

  response.cookies.set('csrf_token', '', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set(GOOGLE_OAUTH_SESSION_COOKIE, '', googleOAuthCookieOptions(0, secure));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', googleOAuthCookieOptions(0, secure));

  return response;
}
