import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { exchangeGoogleAuthorizationCode, GOOGLE_GMAIL_SCOPES } from '@/lib/google-oauth/client';
import {
  GOOGLE_OAUTH_SESSION_COOKIE,
  GOOGLE_OAUTH_PURPOSE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleOAuthCookieOptions,
  matchesGoogleOAuthState,
  sealGoogleOAuthSession,
} from '@/lib/google-oauth/session';
import { isSecureRequest } from '@/lib/auth/cookie-options';

function oauthRedirect(request: NextRequest, role: string, purpose: string, result: 'connected' | 'denied' | 'failed') {
  const returnTo = request.cookies.get('google_oauth_return_to')?.value;
  if (returnTo && returnTo.startsWith('/')) {
    const redirect = new URL(returnTo, request.url);
    redirect.searchParams.set('google_oauth', result);
    return NextResponse.redirect(redirect);
  }
  const redirect = new URL(role === 'mentor' ? '/mentor/placement-followups' : `/${role === 'manager' ? 'manager' : 'admin'}/sheets`, request.url);
  redirect.searchParams.set('google_oauth', result);
  return NextResponse.redirect(redirect);
}

export async function GET(request: NextRequest) {
  try {
    const user = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const purpose = request.cookies.get(GOOGLE_OAUTH_PURPOSE_COOKIE)?.value === 'gmail' ? 'gmail' : 'sheets';
    const query = request.nextUrl.searchParams;
    if (query.get('error')) return oauthRedirect(request, user.role, purpose, 'denied');
    if (!matchesGoogleOAuthState(query.get('state'), request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value)) {
      return oauthRedirect(request, user.role, purpose, 'failed');
    }
    const code = query.get('code');
    if (!code) return oauthRedirect(request, user.role, purpose, 'failed');
    const grant = await exchangeGoogleAuthorizationCode(code, purpose === 'gmail' ? GOOGLE_GMAIL_SCOPES : undefined);
    const session = { ...grant, placementUserId: user.id };
    const response = oauthRedirect(request, user.role, purpose, 'connected');
    const secure = isSecureRequest(request);
    response.cookies.set(GOOGLE_OAUTH_SESSION_COOKIE, sealGoogleOAuthSession(session), googleOAuthCookieOptions(30 * 24 * 60 * 60, secure));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', googleOAuthCookieOptions(0, secure));
    response.cookies.set(GOOGLE_OAUTH_PURPOSE_COOKIE, '', googleOAuthCookieOptions(0, secure));
    response.cookies.set('google_oauth_return_to', '', googleOAuthCookieOptions(0, secure));
    return response;
  } catch {
    const role = request.headers.get('x-user-role') || 'admin';
    return oauthRedirect(request, role, request.cookies.get(GOOGLE_OAUTH_PURPOSE_COOKIE)?.value || 'sheets', 'failed');
  }
}
