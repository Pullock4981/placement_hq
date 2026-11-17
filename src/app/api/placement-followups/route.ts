import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/helpers';
import { GOOGLE_OAUTH_SESSION_COOKIE, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { CENTRAL_FOLLOWUP_EMAIL, sendPlacementFollowupEmail } from '@/lib/placement-followups/email';
import { defaultFollowupTemplate, renderFollowupTemplate } from '@/lib/placement-followups/templates';
import { createFollowupRecord, followupTokenHash, getMentorFollowupCandidates } from '@/lib/placement-followups/sheets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SendSchema = z.object({
  items: z.array(z.object({
    placement_id: z.string().min(1).max(100),
    milestone: z.union([z.literal(45), z.literal(90)]),
    subject: z.string().trim().min(3).max(200).optional(),
    body: z.string().trim().min(10).max(5000).optional(),
    recipient_override: z.string().trim().email().optional(),
  })).min(1).max(50),
  cc: z.array(z.string().trim().email()).max(10).default([]),
});

function apiError(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  return NextResponse.json({ message: error instanceof Error ? error.message : 'Placement follow-ups are temporarily unavailable.' }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    if (user.role !== 'mentor') return NextResponse.json({ message: 'Mentor access is required.' }, { status: 403 });
    const session = openGoogleOAuthSession(request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value);
    const connected = Boolean(session?.placementUserId === user.id);
    const canSendGmail = Boolean(connected && session?.scope.split(/\s+/).includes('https://www.googleapis.com/auth/gmail.send'));
    return NextResponse.json({ data: {
      candidates: await getMentorFollowupCandidates(user),
      sender: { connected, canSendGmail, email: canSendGmail ? session?.email ?? null : null, centralEmail: CENTRAL_FOLLOWUP_EMAIL, mentorEmail: user.email },
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireRole(request.headers, ['mentor']);
    if (user.role !== 'mentor') return NextResponse.json({ message: 'Mentor access is required.' }, { status: 403 });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: 'Cross-origin request rejected.' }, { status: 403 });
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return NextResponse.json({ message: 'Email sending is disabled in demo mode.' }, { status: 403 });
    const parsed = SendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join(' ') }, { status: 400 });
    const candidates = await getMentorFollowupCandidates(user);
    const byId = new Map(candidates.map((candidate) => [candidate.placement_id, candidate]));
    const session = openGoogleOAuthSession(request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value);
    const mentorSession = session?.placementUserId === user.id ? session : null;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin).replace(/\/$/, '');
    const sent: Array<{ placement_id: string; milestone: number; candidate: string }> = [];
    const skipped: Array<{ placement_id: string; reason: string }> = [];
    const failed: Array<{ placement_id: string; candidate: string; reason: string }> = [];
    const processed = new Set<string>();
    for (const item of parsed.data.items) {
      const itemKey = `${item.placement_id}:${item.milestone}`;
      if (processed.has(itemKey)) { skipped.push({ placement_id: item.placement_id, reason: 'Duplicate selection was ignored.' }); continue; }
      processed.add(itemKey);
      const candidate = byId.get(item.placement_id);
      if (!candidate) { skipped.push({ placement_id: item.placement_id, reason: 'Candidate is not available for follow-up.' }); continue; }
      if (!candidate.email) { skipped.push({ placement_id: item.placement_id, reason: 'Candidate email is missing.' }); continue; }
      if (candidate.days_since_placement < item.milestone) { skipped.push({ placement_id: item.placement_id, reason: `${item.milestone}-day follow-up is not due yet.` }); continue; }
      if (candidate.followups[item.milestone]) { skipped.push({ placement_id: item.placement_id, reason: `${item.milestone}-day follow-up was already sent.` }); continue; }
      try {
        const defaults = defaultFollowupTemplate(candidate, item.milestone);
        const token = randomBytes(32).toString('base64url');
        const url = `${appUrl}/placement-followup/${token}`;
        const subject = renderFollowupTemplate(item.subject || defaults.subject, candidate, item.milestone, url, user.name);
        const sourceBody = item.body || defaults.body;
        const body = renderFollowupTemplate(sourceBody, candidate, item.milestone, url, user.name).trim();
        const recipient = process.env.NODE_ENV === 'production' ? candidate.email : item.recipient_override || candidate.email;
        const cc = Array.from(new Set([user.email.toLowerCase(), ...parsed.data.cc.map((email) => email.toLowerCase())]));
        const delivery = await sendPlacementFollowupEmail({ to: recipient, cc, subject, body, mentorEmail: user.email, mentorSession });
        await createFollowupRecord({ candidate, milestone: item.milestone, user, subject, body, tokenHash: followupTokenHash(token), sentFrom: delivery.sender, providerMessageId: delivery.messageId });
        sent.push({ placement_id: item.placement_id, milestone: item.milestone, candidate: candidate.name });
      } catch (error) {
        console.error(`[Placement follow-ups] Failed to send ${item.milestone}-day email to ${candidate.name}:`, error);
        failed.push({ placement_id: item.placement_id, candidate: candidate.name, reason: error instanceof Error ? error.message : 'Email delivery failed.' });
      }
    }
    const message = `${sent.length} follow-up email${sent.length === 1 ? '' : 's'} sent${failed.length ? `; ${failed.length} failed` : ''}.`;
    return NextResponse.json({ sent, skipped, failed, message }, { status: sent.length ? 200 : failed.length ? 502 : 409 });
  } catch (error) { return apiError(error); }
}
