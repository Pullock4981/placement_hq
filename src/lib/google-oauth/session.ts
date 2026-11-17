import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const GOOGLE_OAUTH_STATE_COOKIE = 'placement_google_oauth_state';
export const GOOGLE_OAUTH_SESSION_COOKIE = 'placement_google_oauth_session';
export const GOOGLE_OAUTH_PURPOSE_COOKIE = 'placement_google_oauth_purpose';

export interface GoogleOAuthSession {
  placementUserId: string;
  email: string;
  refreshToken: string;
  scope: string;
  connectedAt: string;
}

function encryptionKey() {
  const secret = process.env.GOOGLE_OAUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error('GOOGLE_OAUTH_COOKIE_SECRET must contain at least 32 characters.');
  return createHash('sha256').update(secret).digest();
}

export function createGoogleOAuthState() {
  return randomBytes(32).toString('base64url');
}

export function matchesGoogleOAuthState(received: string | null | undefined, expected: string | null | undefined) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function sealGoogleOAuthSession(session: GoogleOAuthSession) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return [initializationVector, authenticationTag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function openGoogleOAuthSession(value: string | undefined): GoogleOAuthSession | null {
  if (!value) return null;
  try {
    const [initializationVector, authenticationTag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!initializationVector || !authenticationTag || !encrypted) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), initializationVector);
    decipher.setAuthTag(authenticationTag);
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as Partial<GoogleOAuthSession>;
    if (!payload.placementUserId || !payload.email || !payload.refreshToken || !payload.connectedAt || typeof payload.scope !== 'string') return null;
    return payload as GoogleOAuthSession;
  } catch {
    return null;
  }
}

export function googleOAuthCookieOptions(maxAge: number, secure = process.env.NODE_ENV === 'production') {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
