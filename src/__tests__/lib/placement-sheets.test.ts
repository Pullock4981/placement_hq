import { describe, expect, it } from 'vitest';
import { mergePlacementRecord, parsePlacementMessage } from '@/lib/placement-sync/sheets';
import type { DiscordPlacementMessage } from '@/lib/placement-sync/discord';

function message(content: string): DiscordPlacementMessage {
  return {
    id: '123456789012345678',
    channel_id: '223456789012345678',
    timestamp: '2026-08-30T10:30:00.000Z',
    edited_timestamp: null,
    type: 0,
    content,
    author: { id: '323456789012345678', username: 'mentor', global_name: 'Mentor Name' },
    member: { nick: 'Mentor Nick' },
    embeds: [],
    attachments: [],
  };
}

describe('direct Google Sheets placement parser', () => {
  it('parses the standard successfully-placed message and keeps audit fields', () => {
    const result = parsePlacementMessage(message(`@everyone
Candidate Name: Md. Atikul Haq Rana
Email: ranakhandev2025\\@gmail.com
Company: Neurosoftic
Location: Green Road, Dhaka-1215
Position: Full Stack Developer
Job type: Intern
Batch: 13
Course: L1
Project Name: EJP 13
**Verified By Confirmation Message**`), '423456789012345678', '223456789012345678');

    expect(result).toMatchObject({
      discord_message_id: '123456789012345678',
      candidate_name: 'Md. Atikul Haq Rana',
      candidate_email: 'ranakhandev2025@gmail.com',
      company_name: 'Neurosoftic',
      mentor_name: 'Mentor Nick',
      mentor_email: '',
      verification_status: 'pending',
      verification_evidence: 'Verified By Confirmation Message',
      parse_status: 'valid',
      month_key: '2026-08',
      discord_message_url: 'https://discord.com/channels/423456789012345678/223456789012345678/123456789012345678',
    });
  });

  it('ignores unrelated messages and flags missing required fields', () => {
    expect(parsePlacementMessage(message('Congratulations everyone!'), 'guild', 'channel')).toBeNull();
    expect(parsePlacementMessage(message('Candidate Name: Example Student'), 'guild', 'channel')).toMatchObject({
      parse_status: 'needs_review',
      parse_errors: expect.stringContaining('Missing candidate_email'),
    });
  });

  it('captures an explicit rehired placement type for analytics', () => {
    const result = parsePlacementMessage(message(`Candidate Name: Returning Student
Email: returning@example.com
Company: Acme
Position: Software Engineer
Placement Type: Rehired
Batch: 12`), 'guild', 'channel');

    expect(result).toMatchObject({ job_type: 'Rehired', parse_status: 'valid' });
  });

  it.each([
    ['Notes: This is a rehired placement'],
    ['Career Upgradation: Confirmed'],
    ['Fresher or Career upgraded: Rehired'],
    ['Career Upgraded/ Upgradation: Career Upgraded'],
  ])('normalizes rehired and career-upgradation signals from %s', (signal) => {
    const result = parsePlacementMessage(message(`Candidate Name: Returning Student
Email: returning@example.com
Company: Acme
Position: Software Engineer
${signal}
Batch: 12`), 'guild', 'channel');

    expect(result).toMatchObject({ job_type: 'Rehired', parse_status: 'valid' });
  });

  it('keeps the combined placement field fresh when Fresher is selected', () => {
    const result = parsePlacementMessage(message(`Candidate Name: New Student
Email: fresh@example.com
Company: Acme
Position: Software Engineer
Fresher or Career upgraded: Fresher
Batch: 12`), 'guild', 'channel');

    expect(result).toMatchObject({ job_type: 'Fresher', parse_status: 'valid' });
  });

  it('replaces Discord-owned data on resync while preserving review fields', () => {
    const first = parsePlacementMessage(message(`Candidate Name: Returning Student
Email: returning@example.com
Company: Old Company
Position: Developer
Batch: 12`), 'guild', 'channel')!;
    const edited = parsePlacementMessage({ ...message(`Candidate Name: Returning Student
Email: returning@example.com
Company: New Company
Position: Senior Developer
Career Upgradation: Rehired
Batch: 12`), edited_timestamp: '2026-08-31T08:00:00.000Z' }, 'guild', 'channel')!;
    const merged = mergePlacementRecord(edited, { ...first, verification_status: 'verified', verification_notes: 'Checked by manager' });

    expect(merged).toMatchObject({
      discord_message_id: first.discord_message_id,
      company_name: 'New Company',
      position: 'Senior Developer',
      job_type: 'Rehired',
      edited_at: '2026-08-31T08:00:00.000Z',
      verification_status: 'verified',
      verification_notes: 'Checked by manager',
    });
  });
});
