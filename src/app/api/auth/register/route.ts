import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { RegisterSchema } from '@/lib/validators/auth.schema';
import { DuplicateAccountError, DuplicateDiscordIdentityError, registerPendingUser } from '@/lib/auth/users';
import { rateLimitLogin } from '@/lib/security/rate-limit-middleware';

function unavailableResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const hasExplicitCredential = Boolean(
    (process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_APPS_SCRIPT_SECRET)
    || process.env.GOOGLE_SHEETS_REFRESH_TOKEN
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
  if (!hasExplicitCredential || /default credentials|credential/i.test(message)) {
    return NextResponse.json({
      message: 'Google Sheets is not authorized on this server. Configure the Apps Script gateway URL and secret, then restart the app.',
      code: 'GOOGLE_SHEETS_AUTH_REQUIRED',
    }, { status: 503 });
  }
  if (/invalid_grant|invalid credentials|unauthorized/i.test(message)) {
    return NextResponse.json({
      message: 'Google Sheets rejected the server request. Confirm the Apps Script secret and deployment access, then deploy a new version.',
      code: 'GOOGLE_SHEETS_AUTH_EXPIRED',
    }, { status: 503 });
  }
  return NextResponse.json({
    message: 'Google Sheets could not save the account. Confirm the spreadsheet ID, the users tab, and edit access for the configured Google account.',
    code: 'AUTH_SERVICE_UNAVAILABLE',
  }, { status: 503 });
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Registration is disabled in demo mode.' }, { status: 403 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const limit = await rateLimitLogin(request);
  if (!limit.allowed) return limit.response;

  try {
    const result = RegisterSchema.safeParse(await request.json().catch(() => null));
    if (!result.success) return NextResponse.json({ message: 'Please check your registration details.', errors: result.error.flatten().fieldErrors }, { status: 400 });
    const passwordHash = await bcrypt.hash(result.data.password, 12);
    const user = await registerPendingUser({ name: result.data.name, email: result.data.email, passwordHash, teamRole: result.data.teamRole, discordUsername: result.data.discordUsername, discordUserId: result.data.discordUserId });
    return NextResponse.json({ user, message: 'Account created. An administrator must approve it before you can sign in.' }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof DuplicateAccountError) return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 });
    if (error instanceof DuplicateDiscordIdentityError) return NextResponse.json({ message: error.message }, { status: 409 });
    return unavailableResponse(error);
  }
}
