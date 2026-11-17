export const STUDENT_STAGE = {
  LEARNING: 'learning',
  APPLYING: 'applying',
  INTERVIEWING: 'interviewing',
  OFFER_PENDING: 'offer_pending',
  PLACED: 'placed',
  HIRED: 'hired',
} as const;

export const STUDENT_STAGES = [
  STUDENT_STAGE.LEARNING,
  STUDENT_STAGE.APPLYING,
  STUDENT_STAGE.INTERVIEWING,
  STUDENT_STAGE.OFFER_PENDING,
  STUDENT_STAGE.PLACED,
  STUDENT_STAGE.HIRED,
] as const;

export const MENTOR_STUDENT_STATUSES = [
  'Interview Attempt 1',
  'Interview Attempt 2',
  'Interview Attempt 3',
  'Interview Attempt 4',
  'Interview Attempt 5',
  'Interview Attempt 6',
  'Interview Attempt 7',
  'Interview Attempt 8',
  'Interview Attempt 9',
  'Interview Attempt 10',
  'Hired',
  'Joined',
  'Blocked',
  'Kicked Out',
  'Not Continued',
] as const;

export type MentorStudentStatus = (typeof MENTOR_STUDENT_STATUSES)[number];

export const RISK_STATUS = { SAFE: 'safe', AT_RISK: 'at_risk' } as const;
export const RISK_STATUSES = [RISK_STATUS.SAFE, RISK_STATUS.AT_RISK] as const;

export const RISK_LEVEL = { SAFE: 'safe', MEDIUM: 'medium', HIGH: 'high' } as const;
export const RISK_LEVELS = [RISK_LEVEL.SAFE, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH] as const;

export const JOB_FOCUS = { REMOTE: 'remote', ONSITE: 'onsite', HYBRID: 'hybrid' } as const;
export const JOB_FOCUSES = [JOB_FOCUS.REMOTE, JOB_FOCUS.ONSITE, JOB_FOCUS.HYBRID] as const;

export const EXPERIENCE_LEVEL = { FRESHER: 'fresher', EXPERIENCED: 'experienced' } as const;
export const EXPERIENCE_LEVELS = [EXPERIENCE_LEVEL.FRESHER, EXPERIENCE_LEVEL.EXPERIENCED] as const;

export const PROJECT_NAME = {
  ENDGAME: 'Endgame',
  SCPC: 'SCPC',
  EAP: 'EAP',
  SQUID_GAME: 'Squid Game',
  KAIZEN: 'Kaizen',
  ODYSSEY: 'Odyssey',
  STN: 'STN',
  OTHER: 'Other',
} as const;

export const PROJECT_NAMES = [
  PROJECT_NAME.ENDGAME,
  PROJECT_NAME.SCPC,
  PROJECT_NAME.EAP,
  PROJECT_NAME.SQUID_GAME,
  PROJECT_NAME.KAIZEN,
  PROJECT_NAME.ODYSSEY,
  PROJECT_NAME.STN,
  PROJECT_NAME.OTHER,
] as const;

export const COMPANY_STATUS = { ACTIVE: 'active', CLOSED: 'closed', PAUSED: 'paused' } as const;
export const COMPANY_STATUSES = [COMPANY_STATUS.ACTIVE, COMPANY_STATUS.CLOSED, COMPANY_STATUS.PAUSED] as const;

