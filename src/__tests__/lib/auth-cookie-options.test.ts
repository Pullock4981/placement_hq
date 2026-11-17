import { describe, expect, it } from 'vitest';
import { isSecureRequest } from '@/lib/auth/cookie-options';

describe('authentication cookie transport', () => {
  it('allows cookies on local HTTP while retaining Secure cookies on HTTPS', () => {
    expect(isSecureRequest(new Request('http://localhost:3000/api/auth/login'))).toBe(false);
    expect(isSecureRequest(new Request('https://placement.example.com/api/auth/login'))).toBe(true);
  });

  it('uses the reverse proxy protocol for deployed requests', () => {
    expect(isSecureRequest(new Request('http://internal:3000/api/auth/login', { headers: { 'x-forwarded-proto': 'https' } }))).toBe(true);
    expect(isSecureRequest(new Request('https://internal/api/auth/login', { headers: { 'x-forwarded-proto': 'http' } }))).toBe(false);
  });
});
