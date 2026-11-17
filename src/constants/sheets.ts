export const SHEET_DOMAIN = {
  CENTRAL_SYSTEM: 'central_system',
  PLACEMENTS: 'placement_information',
  SCRUM_UPDATES: 'scrum_updates',
  DAILY_GOALS: 'daily_goals',
  WEEKLY_KPIS: 'weekly_kpis',
  MONTHLY_KPIS: 'monthly_kpis',
  QUARTERLY_OKRS: 'quarterly_okrs',
  PERFORMANCE_PLANS: 'performance_plans',
  STUDENTS: 'student_information',
  COMPANIES: 'company_information',
  AUDIT_LOG: 'audit_log',
} as const;

export const SHEET_DOMAINS = [
  SHEET_DOMAIN.CENTRAL_SYSTEM,
  SHEET_DOMAIN.PLACEMENTS,
  SHEET_DOMAIN.SCRUM_UPDATES,
  SHEET_DOMAIN.DAILY_GOALS,
  SHEET_DOMAIN.WEEKLY_KPIS,
  SHEET_DOMAIN.MONTHLY_KPIS,
  SHEET_DOMAIN.QUARTERLY_OKRS,
  SHEET_DOMAIN.STUDENTS,
  SHEET_DOMAIN.COMPANIES,
  SHEET_DOMAIN.AUDIT_LOG,
] as const;

export const SHEET_TAB = {
  REGISTRY: 'sheets',
  LEGACY_REGISTRY: 'sheet_connections',
  USERS: 'users',
  BATCHES: 'batches',
  PLACEMENT_MONTH_PATTERN: 'MM_YYYY',
  PLACEMENT_SYNC_LOG: 'placement_sync_log',
  SCRUM_WEEK_PATTERN: 'Www_YYYY',
  SCRUM_SYNC_LOG: 'scrum_sync_log',
  DAILY_GOALS: 'daily_goals',
  WEEKLY_KPIS: 'weekly_kpis',
  WEEKLY_GOALS: 'weekly_goals',
  MONTHLY_KPIS: 'monthly_kpis',
  QUARTERLY_OKRS: 'quarterly_okrs',
  PERFORMANCE_PLANS: 'performance_plans',
  PLACEMENT_FOLLOWUPS: 'placement_followups',
  MENTOR_BATCHES: 'batchs',
  MENTOR_STUDENT_SHEETS: 'mentor_student_sheets',
  STUDENTS: 'students',
  COMPANIES: 'companies',
  AUDIT_LOG: 'audit_log',
  SYSTEM_CONFIG: 'system_config',
} as const;

export const SHEET_SCOPE = { GLOBAL: 'GLOBAL' } as const;
export const SHEET_ACCESS_MODE = { READ_ONLY: 'read_only', READ_WRITE: 'read_write' } as const;
export const SHEET_CONNECTION_STATUS = { CONNECTED: 'connected' } as const;

export const PLACEMENT_MONTH_NUMBERS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;

export function placementMonthTab(year: number | string, month: number | string): string {
  const normalizedYear = String(year);
  const normalizedMonth = String(month).padStart(2, '0');
  if (!/^\d{4}$/.test(normalizedYear) || !/^(0[1-9]|1[0-2])$/.test(normalizedMonth)) {
    throw new Error('Placement month tabs require a four-digit year and month 01-12');
  }
  return `${normalizedMonth}_${normalizedYear}`;
}

export function placementYearTabs(year: number | string): string[] {
  return PLACEMENT_MONTH_NUMBERS.map((month) => placementMonthTab(year, month));
}

export function scrumWeekTab(year: number | string, week: number | string): string {
  const normalizedYear = String(year);
  const normalizedWeek = String(week).padStart(2, '0');
  if (!/^\d{4}$/.test(normalizedYear) || !/^(0[1-9]|[1-4]\d|5[0-3])$/.test(normalizedWeek)) {
    throw new Error('Scrum week tabs require a four-digit year and week 01-53');
  }
  return `W${normalizedWeek}_${normalizedYear}`;
}

export function scrumYearTabs(year: number | string): string[] {
  return Array.from({ length: 53 }, (_, index) => scrumWeekTab(year, index + 1));
}

export const SHEET_RESOURCE = {
  PLACEMENTS: { domain: SHEET_DOMAIN.PLACEMENTS, primaryTab: placementMonthTab(new Date().getUTCFullYear(), '01'), tabPattern: SHEET_TAB.PLACEMENT_MONTH_PATTERN },
  SCRUM_UPDATES: { domain: SHEET_DOMAIN.SCRUM_UPDATES, primaryTab: scrumWeekTab(new Date().getUTCFullYear(), '01'), tabPattern: SHEET_TAB.SCRUM_WEEK_PATTERN },
  DAILY_GOALS: { domain: SHEET_DOMAIN.DAILY_GOALS, primaryTab: SHEET_TAB.DAILY_GOALS },
  WEEKLY_KPIS: { domain: SHEET_DOMAIN.WEEKLY_KPIS, primaryTab: SHEET_TAB.WEEKLY_KPIS },
  MONTHLY_KPIS: { domain: SHEET_DOMAIN.MONTHLY_KPIS, primaryTab: SHEET_TAB.PERFORMANCE_PLANS },
  QUARTERLY_OKRS: { domain: SHEET_DOMAIN.QUARTERLY_OKRS, primaryTab: SHEET_TAB.PERFORMANCE_PLANS },
  STUDENTS: { domain: SHEET_DOMAIN.STUDENTS, primaryTab: SHEET_TAB.STUDENTS },
  COMPANIES: { domain: SHEET_DOMAIN.COMPANIES, primaryTab: SHEET_TAB.COMPANIES },
  AUDIT_LOG: { domain: SHEET_DOMAIN.AUDIT_LOG, primaryTab: SHEET_TAB.AUDIT_LOG },
} as const;
