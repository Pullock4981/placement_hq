import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { GOOGLE_OAUTH_SCOPES, missingGoogleOAuthConfiguration } from '@/lib/google-oauth/client';
import { GOOGLE_OAUTH_SESSION_COOKIE, googleOAuthCookieOptions, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { isSecureRequest } from '@/lib/auth/cookie-options';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return NextResponse.json({ configured: false, connected: false, email: null, connectedAt: null, scopes: GOOGLE_OAUTH_SCOPES, missingConfiguration: [], storage: 'disabled', backend: 'google_apis', demoMode: true });
    }
    const manager = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const missingConfiguration = missingGoogleOAuthConfiguration();
    const session = missingConfiguration.length ? null : openGoogleOAuthSession(request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value);
    const connected = Boolean(session && session.placementUserId === manager.id);
    const grantedScopes = new Set(session?.scope.split(/\s+/).filter(Boolean) ?? []);
    const response = NextResponse.json({
      configured: missingConfiguration.length === 0,
      connected,
      email: connected ? session?.email ?? null : null,
      connectedAt: connected ? session?.connectedAt ?? null : null,
      canManageSheets: connected && grantedScopes.has('https://www.googleapis.com/auth/spreadsheets'),
      canManageDriveFiles: connected && grantedScopes.has('https://www.googleapis.com/auth/drive.file'),
      canSendGmail: connected && grantedScopes.has('https://www.googleapis.com/auth/gmail.send'),
      scopes: GOOGLE_OAUTH_SCOPES,
      missingConfiguration,
      storage: 'encrypted_test_session',
      backend: 'google_apis',
      demoMode: false,
    }, { headers: { 'Cache-Control': 'no-store' } });
    if (session && !connected) response.cookies.set(GOOGLE_OAUTH_SESSION_COOKIE, '', googleOAuthCookieOptions(0, isSecureRequest(request)));
    return response;
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return NextResponse.json({ message: apiError.message ?? 'Unable to read Google OAuth status.' }, { status: apiError.status === 401 || apiError.status === 403 ? apiError.status : 500 });
  }
}
