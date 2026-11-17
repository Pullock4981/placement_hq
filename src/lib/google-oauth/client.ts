import { google } from 'googleapis';
import type { GoogleOAuthSession } from './session';

export const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
] as const;

export const GOOGLE_GMAIL_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

const REQUIRED_ENVIRONMENT = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'GOOGLE_OAUTH_COOKIE_SECRET',
] as const;

export function missingGoogleOAuthConfiguration() {
  return REQUIRED_ENVIRONMENT.filter((name) => {
    const value = process.env[name];
    return !value || (name === 'GOOGLE_OAUTH_COOKIE_SECRET' && value.length < 32);
  });
}

function oauthClient() {
  const missing = missingGoogleOAuthConfiguration();
  if (missing.length) throw new Error(`Google OAuth is missing configuration: ${missing.join(', ')}`);
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

export function createGoogleAuthorizationUrl(state: string, scopes: readonly string[] = GOOGLE_OAUTH_SCOPES) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: true,
    scope: [...scopes],
    state,
  });
}

export async function exchangeGoogleAuthorizationCode(code: string, expectedScopes: readonly string[] = GOOGLE_OAUTH_SCOPES): Promise<Omit<GoogleOAuthSession, 'placementUserId'>> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google did not return an offline refresh token. Revoke the app grant and connect again.');
  client.setCredentials(tokens);
  const profile = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
  if (!profile.data.email) throw new Error('Google did not return the connected account email.');
  return {
    email: profile.data.email,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? expectedScopes.join(' '),
    connectedAt: new Date().toISOString(),
  };
}

export function createAuthorizedGoogleClients(session: GoogleOAuthSession) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: session.refreshToken });
  return {
    sheets: google.sheets({ version: 'v4', auth: client }),
    drive: google.drive({ version: 'v3', auth: client }),
  };
}

export function createAuthorizedGmailClient(session: GoogleOAuthSession) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: session.refreshToken });
  return google.gmail({ version: 'v1', auth: client });
}

export async function verifyGoogleOAuthSession(session: GoogleOAuthSession) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: session.refreshToken });
  const profile = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
  if (!profile.data.email || profile.data.email.toLowerCase() !== session.email.toLowerCase()) {
    throw new Error('The connected Google account no longer matches this OAuth session.');
  }
  return { email: profile.data.email };
}

export async function revokeGoogleOAuthSession(session: GoogleOAuthSession) {
  const client = oauthClient();
  await client.revokeToken(session.refreshToken);
}
