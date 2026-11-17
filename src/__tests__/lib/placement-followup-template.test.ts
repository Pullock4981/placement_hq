import { describe, expect, it } from 'vitest';
import { bulkFollowupTemplate, defaultFollowupTemplate, renderFollowupTemplate } from '@/lib/placement-followups/templates';
import type { FollowupCandidate } from '@/lib/placement-followups/types';

const candidate: FollowupCandidate = {
  placement_id: 'discord-1', name: 'Nadia', email: 'nadia@example.com', company: 'Acme', position: 'Developer',
  placement_date: '2026-08-01', days_since_placement: 90, followups: {},
};

describe('placement follow-up email template', () => {
  it('uses the approved follow-up copy and candidate context', () => {
    const result = defaultFollowupTemplate(candidate, 90);
    expect(result.subject).toBe('Checking in: how is your job going?');
    expect(result.body).toContain('Hi Nadia');
    expect(result.body).toContain('role as Developer at Acme');
    expect(result.body).toContain('https://forms.gle/itxvQtvzFbcinsce9');
    expect(result.body).toContain('{{MENTOR_NAME}}');
  });

  it('personalizes bulk placeholders for each candidate', () => {
    const template = bulkFollowupTemplate(45);
    expect(renderFollowupTemplate(template.subject, candidate, 45, 'unused', 'Touhid Mentor')).toBe('Checking in: how is your job going?');
    const body = renderFollowupTemplate(template.body, candidate, 45, 'unused', 'Touhid Mentor');
    expect(body).toContain('Hi Nadia');
    expect(body).toContain('role as Developer at Acme');
    expect(body).toContain('https://forms.gle/itxvQtvzFbcinsce9');
    expect(body).toContain('Best regards,\nTouhid Mentor\nProgramming Hero');
    expect(body.split('\n').every((line) => !line.startsWith(' '))).toBe(true);
  });
});
