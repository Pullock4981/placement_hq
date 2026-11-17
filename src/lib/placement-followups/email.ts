import 'server-only';

import { google } from 'googleapis';
import type { GoogleOAuthSession } from '@/lib/google-oauth/session';
import { createAuthorizedGmailClient } from '@/lib/google-oauth/client';

export const CENTRAL_FOLLOWUP_EMAIL = process.env.GMAIL_FROM_EMAIL?.trim()
  || 'meet@programminghero.org';

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
}

function emailHtml(body: string) {
  return htmlEscape(body.trim())
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#6d28d9;font-weight:700">$1</a>')
    .replace(/\n/g, '<br>');
}

function centralGmailClient() {
  const refreshToken = process.env.GOOGLE_GMAIL_REFRESH_TOKEN?.trim() || process.env.GOOGLE_SHEETS_REFRESH_TOKEN?.trim();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Connect mentor Gmail or configure GOOGLE_GMAIL_REFRESH_TOKEN for the central sender.');
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth });
}

export async function sendPlacementFollowupEmail(input: {
  to: string; cc?: string[]; subject: string; body: string; mentorEmail: string; mentorSession?: GoogleOAuthSession | null;
}) {
  const hasMentorGmail = Boolean(input.mentorSession?.scope.split(/\s+/).includes('https://www.googleapis.com/auth/gmail.send'));
  const fromEmail = hasMentorGmail ? input.mentorSession!.email : CENTRAL_FOLLOWUP_EMAIL;
  const gmail = hasMentorGmail ? createAuthorizedGmailClient(input.mentorSession!) : centralGmailClient();
  const boundary = `placementhq_${Date.now().toString(36)}`;
  const raw = [
    `From: Programming Hero Placement Team <${fromEmail}>`,
    `To: ${input.to}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    `Reply-To: ${input.mentorEmail}`,
    `Subject: ${encodedHeader(input.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    `<div style="font-family:Arial,sans-serif;width:100%;margin:0;padding:0;color:#172033;line-height:1.7;text-align:left">${emailHtml(input.body)}</div>`,
    '',
    `--${boundary}--`,
  ].join('\r\n');
  const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: Buffer.from(raw).toString('base64url') } });
  return { sender: fromEmail, messageId: result.data.id || '' };
}
