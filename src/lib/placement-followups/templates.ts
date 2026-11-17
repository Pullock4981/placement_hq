import type { FollowupCandidate, FollowupMilestone } from './types';

export function defaultFollowupTemplate(candidate: FollowupCandidate, milestone: FollowupMilestone) {
  void milestone;
  return {
    subject: 'Checking in: how is your job going?',
    body: `Hi ${candidate.name},

Since you started your role as ${candidate.position || 'your new role'} at ${candidate.company || 'your company'}, we would love to know how things are going for you now. Are you still continuing in this role, and how is it going overall?

Could you take 3 minutes to fill out this short form? Your answers help us understand where our graduates are right now and how we can support you better, whether that means interview preparation, a portfolio review, or guidance for your next step.

Form link: https://forms.gle/itxvQtvzFbcinsce9

If anything has changed, such as a new role or a challenge you are facing, just reply to this email. We are always happy to talk one to one.

Keep going, and well done again.

Best regards,
{{MENTOR_NAME}}
Programming Hero`,
  };
}

export function bulkFollowupTemplate(milestone: FollowupMilestone) {
  void milestone;
  return {
    subject: 'Checking in: how is your job going?',
    body: `Hi {{CANDIDATE_NAME}},

Since you started your role as {{POSITION}} at {{COMPANY_NAME}}, we would love to know how things are going for you now. Are you still continuing in this role, and how is it going overall?

Could you take 3 minutes to fill out this short form? Your answers help us understand where our graduates are right now and how we can support you better, whether that means interview preparation, a portfolio review, or guidance for your next step.

Form link: https://forms.gle/itxvQtvzFbcinsce9

If anything has changed, such as a new role or a challenge you are facing, just reply to this email. We are always happy to talk one to one.

Keep going, and well done again.

Best regards,
{{MENTOR_NAME}}
Programming Hero`,
  };
}

export function renderFollowupTemplate(value: string, candidate: FollowupCandidate, milestone: FollowupMilestone, followupUrl: string, mentorName = 'Placement Mentor') {
  return value
    .replaceAll('{{CANDIDATE_NAME}}', candidate.name)
    .replaceAll('{{COMPANY_NAME}}', candidate.company || 'your new company')
    .replaceAll('{{POSITION}}', candidate.position || 'your new role')
    .replaceAll('{{MILESTONE_DAYS}}', String(milestone))
    .replaceAll('{{MENTOR_NAME}}', mentorName)
    .replaceAll('{{FOLLOWUP_URL}}', followupUrl);
}
