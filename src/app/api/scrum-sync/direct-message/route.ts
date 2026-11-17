import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiError, requireRole } from '@/lib/auth/helpers';
import { ScrumDirectMessageError, sendScrumDirectMessage } from '@/lib/scrum-sync/discord';
import { getScrumDashboard, ScrumSheetsError } from '@/lib/scrum-sync/sheets';
import { scrumCurrentWeek, scrumWeekRange } from '@/lib/scrum-sync/week';
import { appendAuditLog } from '@/lib/sheets/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DirectMessageSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  week: z.number().int().min(1).max(53),
  employee: z.string().regex(/^\d{17,20}$/),
  summary: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const manager = requireRole(request.headers, ['manager']);
    if (manager.role !== 'manager') throw createApiError('Forbidden', 403);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw createApiError('Cross-origin request', 403);
    const parsed = DirectMessageSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: 'Choose an employee and create a valid summary first.' }, { status: 400 });
    const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Dhaka', year: 'numeric' }).format(new Date()));
    if (parsed.data.year === currentYear && parsed.data.week > scrumCurrentWeek()) return NextResponse.json({ message: 'A future week cannot be messaged.' }, { status: 400 });
    const expectedTitle = new RegExp(`^#?\\s*Week ${parsed.data.week} Review\\s*$`, 'im');
    if (!expectedTitle.test(parsed.data.summary)) return NextResponse.json({ message: 'Create this week’s summary before sending it.' }, { status: 400 });
    const range = scrumWeekRange(parsed.data.year, parsed.data.week);
    const data = await getScrumDashboard({ year: parsed.data.year, ...range, employee: parsed.data.employee });
    const recipient = data.employees.find((person) => person.id === parsed.data.employee);
    if (!recipient || !data.records.length) return NextResponse.json({ message: 'No verified Scrum employee was found for this selection.' }, { status: 404 });
    const delivery = await sendScrumDirectMessage(recipient.id, parsed.data.summary);
    try {
      await appendAuditLog({
        user_email: manager.email,
        actor_id: manager.id,
        role: manager.role,
        action: 'scrum.summary.discord_dm_sent',
        entity_type: 'user',
        entity_id: recipient.id,
        payload: { employee_name: recipient.name, week: parsed.data.week, year: parsed.data.year, discord_message_id: delivery.messageId },
        request,
      });
    } catch (auditError) {
      console.error('[Scrum Direct Message] Audit log failed after delivery:', auditError);
    }
    return NextResponse.json({ message: `Summary sent to ${recipient.name}.`, messageId: delivery.messageId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
    if (status === 401 || status === 403) return NextResponse.json({ message: status === 401 ? 'Sign in as a manager.' : 'Manager access is required.' }, { status });
    if (error instanceof ScrumDirectMessageError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof ScrumSheetsError) return NextResponse.json({ message: error.message }, { status: error.code === 'NOT_CONFIGURED' ? 503 : 502 });
    console.error('[Scrum Direct Message] Request failed:', error);
    return NextResponse.json({ message: 'The Discord summary could not be sent.' }, { status: 502 });
  }
}
