import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/scrum-sync/direct-message/route';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getScrumDashboard: vi.fn(),
  sendScrumDirectMessage: vi.fn(),
  appendAuditLog: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireRole: mocks.requireRole,
  createApiError: (message: string, status: number) => Object.assign(new Error(message), { status }),
}));
vi.mock('@/lib/scrum-sync/sheets', () => ({ getScrumDashboard: mocks.getScrumDashboard, ScrumSheetsError: class ScrumSheetsError extends Error {} }));
vi.mock('@/lib/scrum-sync/discord', () => ({
  sendScrumDirectMessage: mocks.sendScrumDirectMessage,
  ScrumDirectMessageError: class ScrumDirectMessageError extends Error { constructor(message: string, public status = 502) { super(message); } },
}));
vi.mock('@/lib/sheets/audit', () => ({ appendAuditLog: mocks.appendAuditLog }));

const employeeId = '123456789012345678';
const summary = '# Week 35 Review\n\n### Highlights\n- Delivered planned work';

function request(body: unknown) {
  return new Request('https://app.test/api/scrum-sync/direct-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://app.test' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/scrum-sync/direct-message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockReturnValue({ id: 'manager-1', email: 'manager@example.com', role: 'manager' });
    mocks.getScrumDashboard.mockResolvedValue({
      records: [{ discord_message_id: 'message-1' }],
      employees: [{ id: employeeId, name: 'Talha Tarique', email: '' }],
    });
    mocks.sendScrumDirectMessage.mockResolvedValue({ channelId: '223456789012345678', messageId: '323456789012345678' });
    mocks.appendAuditLog.mockResolvedValue(undefined);
  });

  it('sends the exact summary to the selected employee and audits delivery', async () => {
    const response = await POST(request({ year: 2026, week: 35, employee: employeeId, summary }));
    expect(response.status).toBe(200);
    expect(mocks.sendScrumDirectMessage).toHaveBeenCalledWith(employeeId, summary);
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'scrum.summary.discord_dm_sent', entity_id: employeeId }));
  });

  it('rejects content that was not generated for the selected week', async () => {
    const response = await POST(request({ year: 2026, week: 35, employee: employeeId, summary: 'Arbitrary message' }));
    expect(response.status).toBe(400);
    expect(mocks.sendScrumDirectMessage).not.toHaveBeenCalled();
  });

  it('accepts a previously generated title without a Markdown heading marker', async () => {
    const legacySummary = summary.replace(/^# /, '');
    const response = await POST(request({ year: 2026, week: 35, employee: employeeId, summary: legacySummary }));
    expect(response.status).toBe(200);
    expect(mocks.sendScrumDirectMessage).toHaveBeenCalledWith(employeeId, legacySummary);
  });
});
