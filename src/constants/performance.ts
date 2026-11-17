export const PERFORMANCE_PLAN_TYPE = {
  MONTHLY_KPI: 'monthly_kpi',
  QUARTERLY_OKR: 'quarterly_okr',
} as const;

export const PERFORMANCE_PLAN_TYPES = Object.values(PERFORMANCE_PLAN_TYPE);

export const PERFORMANCE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  AT_RISK: 'at_risk',
} as const;

export const PERFORMANCE_STATUSES = Object.values(PERFORMANCE_STATUS);

export const PERFORMANCE_APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const TEAM_MONTHLY_KPI = {
  mentor: { title: 'Monthly placement goal', metric: 'Students placed', unit: 'placements' },
  project: { title: 'Monthly student supply goal', metric: 'Students supplied', unit: 'students' },
  technical: { title: 'Monthly technical support goal', metric: 'Technical cases completed', unit: 'cases' },
  analytics: { title: 'Monthly analytics delivery goal', metric: 'Analytics reports delivered', unit: 'reports' },
  partner: { title: 'Monthly partner goal', metric: 'Partner opportunities created', unit: 'opportunities' },
  manager: { title: 'Monthly team placement goal', metric: 'Team placements', unit: 'placements' },
} as const;

export const KPI_DIRECTION = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
  MAINTAIN: 'maintain',
} as const;

export const KPI_DIRECTIONS = Object.values(KPI_DIRECTION);

export const PERFORMANCE_UNIT = {
  NUMBER: 'number',
  PERCENT: 'percent',
  CURRENCY: 'currency',
  DAYS: 'days',
  HOURS: 'hours',
  SCORE: 'score',
} as const;

export const PERFORMANCE_UNITS = Object.values(PERFORMANCE_UNIT);

export const QUARTER = {
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
} as const;

export const QUARTERS = Object.values(QUARTER);
