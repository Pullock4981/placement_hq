import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFollowupByToken, submitFollowupResponse } from '@/lib/placement-followups/sheets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ResponseSchema = z.object({
  status: z.enum(['still_employed', 'left_role', 'between_jobs', 'other']),
  reason: z.string().trim().max(1000).default(''),
}).superRefine((value, context) => {
  if (value.status !== 'still_employed' && value.reason.length < 3) context.addIssue({ code: 'custom', path: ['reason'], message: 'Please share a brief reason.' });
});

export async function GET(_: Request, context: { params: { token: string } }) {
  const record = await getFollowupByToken(context.params.token);
  if (!record) return NextResponse.json({ message: 'This follow-up link is invalid or unavailable.' }, { status: 404 });
  return NextResponse.json({ data: { candidate_name: record.candidate_name, company_name: record.company_name, milestone_days: record.milestone_days, responded: Boolean(record.responded_at), response_status: record.response_status } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, context: { params: { token: string } }) {
  try {
    const parsed = ResponseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join(' ') }, { status: 400 });
    const record = await submitFollowupResponse(context.params.token, parsed.data.status, parsed.data.reason);
    return NextResponse.json({ data: { responded: true, response_status: record.response_status } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Your response could not be saved.' }, { status: 400 });
  }
}
