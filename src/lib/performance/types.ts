import type { TeamRole, UserRole } from '@/types';

export interface PerformanceOwner {
  user_id: string;
  user_email: string;
  user_name: string;
  role: UserRole;
  discord_user_id: string;
  discord_username: string;
}

export interface MonthlyKpiRecord extends PerformanceOwner {
  id: string;
  type: 'monthly_kpi';
  month: string;
  title: string;
  metric: string;
  target_value: number;
  baseline_value: number | null;
  unit: string;
  direction: string;
  status: string;
  notes: string;
  manager_note: string;
  created_at: string;
  updated_at: string;
  achieved_count: number;
  remaining_count: number;
  progress_percent: number;
  plan_kind: 'KPI';
  team_role: TeamRole;
  approval_status: 'pending' | 'approved' | 'rejected';
  submitted_by: string;
  approved_by: string;
  approved_at: string;
  edit_count: number;
}

export interface PerformanceMentorOption {
  id: string;
  name: string;
  email: string;
  team_role?: TeamRole;
  team_nickname?: string;
}

export interface OkrKeyResult {
  title: string;
  target_value: number;
  unit: string;
}

export interface QuarterlyOkrRecord extends PerformanceOwner {
  id: string;
  type: 'quarterly_okr';
  year: string;
  quarter: string;
  objective: string;
  key_results: OkrKeyResult[];
  status: string;
  notes: string;
  manager_note: string;
  created_at: string;
  updated_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  submitted_by: string;
  approved_by: string;
  approved_at: string;
}

export interface PerformancePlanData {
  monthlyKpis: MonthlyKpiRecord[];
  quarterlyOkrs: QuarterlyOkrRecord[];
  mentors: PerformanceMentorOption[];
  scope: 'personal' | 'team';
}
