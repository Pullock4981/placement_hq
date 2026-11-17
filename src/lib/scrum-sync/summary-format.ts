type SummarySection = 'highlights' | 'goals' | 'blockers' | 'nextWeek';

export interface ScrumSummaryContext {
  week: number;
  fromDate: string;
  toDate: string;
  updates: number;
  contributors: number;
  activeDays: number;
  blockers: number;
  weeklyGoalsProvided: boolean;
}

export function formatScrumSummary(value: string, context: ScrumSummaryContext) {
  const sections: Record<SummarySection, string[]> = { highlights: [], goals: [], blockers: [], nextWeek: [] };
  let section: SummarySection | null = null;
  value.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/^\s*#{1,6}\s*/, '').trim();
    if (!line || /^week \d+ scrum summary/i.test(line) || /^metrics\s*:?$/i.test(line) || /^prepared automatically/i.test(line)) return;
    if (/^highlights\s*:?$/i.test(line)) { section = 'highlights'; return; }
    if (/^goals?\s*(?:&|vs\.?|and)\s*achievements?\s*:?$/i.test(line)) { section = 'goals'; return; }
    if (/^blockers?\s*(?:&|and)\s*gaps?\s*:?$/i.test(line)) { section = 'blockers'; return; }
    if (/^next week(?: focus)?\s*:?$/i.test(line)) { section = 'nextWeek'; return; }
    if (section) sections[section].push(line.replace(/^[-*•]\s*/, ''));
  });
  const bullets = (items: string[], fallback: string, maximum: number) => (items.length ? items.slice(0, maximum) : [fallback]).map((item) => `- ${item}`).join('\n');
  const goalLines = context.weeklyGoalsProvided
    ? bullets(sections.goals, '**Goals:** Weekly status found; comparison details unavailable.', 8)
    : '- **No specific goals provided.**';
  const blockerLines = context.blockers
    ? bullets(sections.blockers, 'Reported blockers lack specific details.', 5)
    : '- **No major blockers or gaps reported.**';
  return [
    `# Week ${context.week} Review`,
    '',
    '### Highlights',
    bullets(sections.highlights, 'No measurable highlights were provided.', 5),
    '',
    '### Goals & Achievement',
    goalLines,
    '',
    '### Metrics',
    `- **Updates:** ${context.updates}`,
    `- **Contributors:** ${context.contributors}`,
    `- **Active Days:** ${context.activeDays}`,
    `- **Blockers:** ${context.blockers}`,
    '',
    '### Blockers & Gaps',
    blockerLines,
    '',
    '### Next Week Focus',
    bullets(sections.nextWeek, 'No authoritative next-week goals provided.', 3),
    '',
    '*Prepared automatically by PlacementHQ Portal.*',
  ].join('\n');
}
