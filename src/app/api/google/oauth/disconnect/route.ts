import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { revokeGoogleOAuthSession } from '@/lib/google-oauth/client';
import { GOOGLE_OAUTH_SESSION_COOKIE, googleOAuthCookieOptions, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { isSecureRequest } from '@/lib/auth/cookie-options';

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Google OAuth is disabled in demo mode.' }, { status: 403 });
    const manager = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const session = openGoogleOAuthSession(request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value);
    let revoked = false;
    if (session?.placementUserId === manager.id) {
      try {
        await revokeGoogleOAuthSession(session);
        revoked = true;
      } catch {
        revoked = false;
      }
    }
    const response = NextResponse.json({ connected: false, revoked });
    response.cookies.set(GOOGLE_OAUTH_SESSION_COOKIE, '', googleOAuthCookieOptions(0, isSecureRequest(request)));
    return response;
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return NextResponse.json({ message: apiError.message ?? 'Unable to disconnect Google OAuth.' }, { status: apiError.status === 401 || apiError.status === 403 ? apiError.status : 500 });
  }
}
