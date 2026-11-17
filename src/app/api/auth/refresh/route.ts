import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRefreshToken, signAccessToken } from '@/lib/auth/jwt';
import { getAuthUserByEmail } from '@/lib/auth/users';
import { isSecureRequest } from '@/lib/auth/cookie-options';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'Refresh token not found' },
        { status: 401 }
      );
    }

    const payload = await verifyRefreshToken(refreshToken);
    let user = await getAuthUserByEmail(payload.email).catch(() => null);

    // Fallback if not found in live sheet
    const userPayload = user || {
      id: payload.id || 'dev-admin',
      email: payload.email || 'admin@programming-hero.com',
      name: payload.name || 'System Admin',
      role: payload.role || 'admin',
      team_role: payload.team_role,
      team_nickname: payload.team_nickname,
      discord_username: payload.discord_username,
      discord_user_id: payload.discord_user_id,
    };

    const newAccessToken = signAccessToken(userPayload);
    const response = NextResponse.json({ accessToken: newAccessToken });

    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('[Auth] Refresh token error:', error);
    return NextResponse.json(
      { message: 'Invalid or expired refresh token' },
      { status: 401 }
    );
  }
}
