import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthUserByEmail } from '@/lib/auth/users';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { dashboardPathForRole } from '@/lib/auth/routing';
import { isSecureRequest } from '@/lib/auth/cookie-options';
import { setCsrfCookie } from '@/lib/security/csrf';
import type { JWTPayload, UserRole, TeamRole } from '@/types';

// Temporary predefined test accounts
const DEV_USERS: Record<string, JWTPayload> = {
  'admin@programming-hero.com': {
    id: 'dev-admin',
    name: 'System Admin',
    email: 'admin@programming-hero.com',
    role: 'admin',
  },
  'manager@programming-hero.com': {
    id: 'dev-manager',
    name: 'Maliha Chowdhury (Manager)',
    email: 'manager@programming-hero.com',
    role: 'manager',
    team_role: 'manager',
  },
  'mentor@programming-hero.com': {
    id: 'dev-mentor',
    name: 'Afsana Rahman (Mentor)',
    email: 'mentor@programming-hero.com',
    role: 'mentor',
    team_role: 'mentor',
    team_nickname: 'Afsana',
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!rawEmail) {
      return NextResponse.json({ message: 'Email address is required.' }, { status: 400 });
    }

    let userPayload: JWTPayload | undefined;

    // Check predefined system accounts
    if (DEV_USERS[rawEmail]) {
      if (password && password.length >= 6) {
        userPayload = DEV_USERS[rawEmail];
      } else {
        return NextResponse.json({ message: 'Password must be at least 6 characters.' }, { status: 400 });
      }
    }

    // Try real Google Sheet user
    if (!userPayload) {
      try {
        const user = await getAuthUserByEmail(rawEmail);
        if (user && user.password_hash && (await bcrypt.compare(password, user.password_hash))) {
          if (!user.active) {
            return NextResponse.json({ message: 'Account is deactivated. Contact Admin.' }, { status: 403 });
          }
          userPayload = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
            team_role: user.team_role as TeamRole | undefined,
            team_nickname: user.team_nickname,
          };
        }
      } catch (err) {
        console.warn('[Auth] Live user lookup error:', err);
      }
    }

    if (!userPayload) {
      return NextResponse.json({ message: 'Invalid email or password.' }, { status: 401 });
    }

    const secure = isSecureRequest(request);
    const accessToken = signAccessToken(userPayload);
    const refreshToken = signRefreshToken(userPayload);

    const response = NextResponse.json(
      {
        user: userPayload,
        redirectTo: dashboardPathForRole(userPayload.role),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    setCsrfCookie(response, secure);
    return response;
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    return NextResponse.json({ message: err?.message || 'Login failed.' }, { status: 500 });
  }
}
