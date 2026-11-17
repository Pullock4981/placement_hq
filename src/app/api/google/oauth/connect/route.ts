import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { createGoogleAuthorizationUrl, GOOGLE_GMAIL_SCOPES, missingGoogleOAuthConfiguration } from '@/lib/google-oauth/client';
import { createGoogleOAuthState, GOOGLE_OAUTH_PURPOSE_COOKIE, GOOGLE_OAUTH_STATE_COOKIE, googleOAuthCookieOptions } from '@/lib/google-oauth/session';
import { isSecureRequest } from '@/lib/auth/cookie-options';

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Google OAuth is disabled in demo mode.' }, { status: 403 });
    const user = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const purpose = request.nextUrl.searchParams.get('purpose') === 'gmail' ? 'gmail' : 'sheets';
    if (user.role === 'mentor' && purpose !== 'gmail') return NextResponse.json({ message: 'Mentors can connect Gmail only.' }, { status: 403 });
    const missing = missingGoogleOAuthConfiguration();
    if (missing.length) return NextResponse.json({ message: 'Google OAuth is not configured.', missingConfiguration: missing }, { status: 503 });
    const state = createGoogleOAuthState();
    const returnTo = request.nextUrl.searchParams.get('return_to');
    const response = NextResponse.redirect(createGoogleAuthorizationUrl(state, purpose === 'gmail' ? GOOGLE_GMAIL_SCOPES : undefined));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, googleOAuthCookieOptions(10 * 60, isSecureRequest(request)));
    response.cookies.set(GOOGLE_OAUTH_PURPOSE_COOKIE, purpose, googleOAuthCookieOptions(10 * 60, isSecureRequest(request)));
    if (returnTo) {
      response.cookies.set('google_oauth_return_to', returnTo, googleOAuthCookieOptions(10 * 60, isSecureRequest(request)));
    }
    return response;
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return NextResponse.json({ message: apiError.message ?? 'Unable to start Google OAuth.' }, { status: apiError.status === 401 || apiError.status === 403 ? apiError.status : 500 });
  }
}
