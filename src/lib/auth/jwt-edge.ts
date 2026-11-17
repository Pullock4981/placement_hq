import { jwtVerify } from 'jose/jwt/verify';
import { USER_ROLES } from '@/constants';
import type { JWTPayload, UserRole } from '@/types';

export async function verifyAccessTokenEdge(token: string): Promise<JWTPayload> {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_ACCESS_SECRET is not configured');

  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
  if (
    typeof payload.id !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.role !== 'string' ||
    !USER_ROLES.includes(payload.role as UserRole)
  ) {
    throw new Error('Invalid access token payload');
  }

  return payload as unknown as JWTPayload;
}
