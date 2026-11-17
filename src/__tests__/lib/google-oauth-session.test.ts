import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGoogleOAuthState,
  matchesGoogleOAuthState,
  openGoogleOAuthSession,
  sealGoogleOAuthSession,
} from '@/lib/google-oauth/session';

beforeEach(() => vi.stubEnv('GOOGLE_OAUTH_COOKIE_SECRET', 'test-cookie-secret-with-at-least-32-characters'));
afterEach(() => vi.unstubAllEnvs());

describe('Google OAuth test session', () => {
  it('encrypts and restores an offline connection without exposing plaintext', () => {
    const session = { placementUserId: 'manager-1', email: 'owner@example.com', refreshToken: 'refresh-secret', scope: 'scope-a scope-b', connectedAt: '2026-09-02T00:00:00.000Z' };
    const sealed = sealGoogleOAuthSession(session);
    expect(sealed).not.toContain(session.email);
    expect(sealed).not.toContain(session.refreshToken);
    expect(openGoogleOAuthSession(sealed)).toEqual(session);
  });

  it('rejects tampered sessions and mismatched OAuth state', () => {
    const sealed = sealGoogleOAuthSession({ placementUserId: 'manager-1', email: 'owner@example.com', refreshToken: 'secret', scope: '', connectedAt: '2026-09-02T00:00:00.000Z' });
    expect(openGoogleOAuthSession(`${sealed}changed`)).toBeNull();
    const state = createGoogleOAuthState();
    expect(matchesGoogleOAuthState(state, state)).toBe(true);
    expect(matchesGoogleOAuthState(state, `${state}x`)).toBe(false);
    expect(matchesGoogleOAuthState(null, state)).toBe(false);
  });
});
