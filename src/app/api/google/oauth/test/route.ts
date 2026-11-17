import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { verifyGoogleOAuthSession } from '@/lib/google-oauth/client';
import { GOOGLE_OAUTH_SESSION_COOKIE, openGoogleOAuthSession } from '@/lib/google-oauth/session';

export async function POST(request: NextRequest) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Google OAuth is disabled in demo mode.' }, { status: 403 });
    const manager = requireRole(request.headers, ['admin', 'manager', 'mentor']);
    const session = openGoogleOAuthSession(request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value);
    if (!session || session.placementUserId !== manager.id) {
      return NextResponse.json({ message: 'Connect Google before testing the OAuth session.' }, { status: 409 });
    }
    const result = await verifyGoogleOAuthSession(session);
    return NextResponse.json({ ok: true, email: result.email, checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    if (apiError.status === 401 || apiError.status === 403) return NextResponse.json({ message: apiError.message }, { status: apiError.status });
    return NextResponse.json({ message: 'Google OAuth validation failed. Disconnect and reconnect the Google account.' }, { status: 502 });
  }
}
