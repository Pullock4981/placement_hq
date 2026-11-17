import type { GoogleSheetTemplateId } from '@/lib/validators/google-sheet-provision.schema';
import { placementYearTabs, scrumYearTabs, SHEET_TAB } from '@/constants';

export const PLACEMENT_WORKBOOK_HEADERS = [
  'discord_message_id', 'posted_at', 'edited_at', 'month_key',
  'mentor_discord_id', 'mentor_name', 'mentor_email', 'candidate_name',
  'candidate_email', 'phone', 'company_name', 'location', 'position',
  'job_type', 'batch', 'course', 'project_name', 'placement_date',
  'verification_status', 'verification_evidence', 'verified_by', 'verified_at',
  'verification_notes', 'additional_information', 'internal_notes',
  'discord_message_url', 'raw_message', 'parse_status', 'parse_errors', 'synced_at',
] as const;

export const PLACEMENT_SYNC_LOG_HEADERS = [
  'id', 'run_id', 'from_date', 'to_date', 'cursor', 'actor_email',
  'fetched', 'inserted', 'updated', 'unchanged', 'invalid', 'ignored',
  'next_cursor', 'status', 'error', 'started_at', 'completed_at',
] as const;

export const SCRUM_UPDATE_HEADERS = [
  'discord_message_id', 'posted_at', 'update_date', 'week_key',
  'employee_discord_id', 'employee_name', 'employee_email',
  'yesterday', 'today', 'blockers', 'raw_message', 'parse_status',
  'parse_errors', 'discord_message_url', 'synced_at', 'updated_at',
] as const;

export const SCRUM_SYNC_LOG_HEADERS = PLACEMENT_SYNC_LOG_HEADERS;

export const MONTHLY_KPI_HEADERS = [
  'id', 'user_id', 'user_email', 'user_name', 'role', 'month', 'title', 'metric',
  'target_value', 'baseline_value', 'unit', 'direction', 'status', 'notes', 'created_at', 'updated_at',
  'plan_kind', 'team_role', 'approval_status', 'submitted_by', 'approved_by', 'approved_at', 'edit_count',
] as const;

export const QUARTERLY_OKR_HEADERS = [
  'id', 'user_id', 'user_email', 'user_name', 'role', 'year', 'quarter', 'objective',
  'key_results_json', 'status', 'notes', 'created_at', 'updated_at', 'plan_kind',
] as const;

export const PERFORMANCE_PLAN_HEADERS = [
  'id', 'plan_kind', 'period_type', 'period_key', 'month', 'year', 'quarter',
  'user_id', 'discord_user_id', 'discord_username', 'user_email', 'user_name',
  'access_role', 'team_role', 'title', 'metric', 'target_value', 'baseline_value',
  'unit', 'direction', 'key_results_json', 'status', 'approval_status', 'notes',
  'submitted_by', 'approved_by', 'approved_at', 'edit_count', 'created_at', 'updated_at',
  'manager_note',
] as const;

export const WEEKLY_GOAL_HEADERS = [
  'id', 'week_key', 'week_number', 'year', 'week_start', 'week_end',
  'user_id', 'user_email', 'user_name', 'discord_user_id', 'discord_username',
  'goals_json', 'comments_json', 'created_at', 'updated_at',
] as const;

export const PLACEMENT_FOLLOWUP_HEADERS = [
  'id', 'placement_id', 'milestone_days', 'mentor_id', 'mentor_email', 'mentor_name',
  'candidate_name', 'candidate_email', 'company_name', 'position', 'placement_date',
  'status', 'email_subject', 'email_body', 'response_token_hash', 'sent_from',
  'provider_message_id', 'sent_at', 'response_status', 'response_reason',
  'responded_at', 'created_at', 'updated_at',
] as const;

export interface WorkbookTabTemplate {
  title: string;
  headers: readonly string[];
  rows?: readonly (readonly string[])[];
  filter?: boolean;
}

export interface WorkbookTemplate {
  id: GoogleSheetTemplateId;
  label: string;
  description: string;
  tabs: readonly WorkbookTabTemplate[];
}

const configRows = (template: GoogleSheetTemplateId, createdAt: string, year?: number) => [
  ['schema_version', '1', 'PlacementHQ-managed workbook schema version'],
  ['template', template, 'Workbook template created by PlacementHQ'],
  ['time_zone', 'Asia/Dhaka', 'Dates and reporting use Bangladesh time'],
  ['managed_by', 'PlacementHQ Next.js', 'Do not rename managed tabs without updating the app'],
  ['created_at', createdAt, 'Workbook creation timestamp'],
  ...(year ? [[template === 'placement_management' ? 'placement_year' : 'reporting_year', String(year), 'Annual workbook assignment']] as const : []),
] as const;

export function getWorkbookTemplate(template: GoogleSheetTemplateId, createdAt: string, year?: number): WorkbookTemplate {
  if (template === 'placement_management') {
    if (!year) throw new Error('Placement workbook year is required');
    return {
      id: template,
      label: 'Placement Management',
      description: 'Discord placement records, verification fields, and synchronization history.',
      tabs: [
        ...placementYearTabs(year).map((title) => ({ title, headers: PLACEMENT_WORKBOOK_HEADERS, filter: true })),
        { title: SHEET_TAB.PLACEMENT_SYNC_LOG, headers: PLACEMENT_SYNC_LOG_HEADERS, filter: true },
        { title: 'config', headers: ['key', 'value', 'description'], rows: configRows(template, createdAt, year) },
      ],
    };
  }

  if (template === 'scrum_management') {
    if (!year) throw new Error('Scrum workbook year is required');
    return {
      id: template,
      label: 'Daily Scrum Management',
      description: 'Discord scrum updates organized into annual weekly tabs.',
      tabs: [
        ...scrumYearTabs(year).map((title) => ({ title, headers: SCRUM_UPDATE_HEADERS, filter: true })),
        { title: SHEET_TAB.SCRUM_SYNC_LOG, headers: SCRUM_SYNC_LOG_HEADERS, filter: true },
        { title: 'config', headers: ['key', 'value', 'description'], rows: configRows(template, createdAt, year) },
      ],
    };
  }

  if (template === 'performance_management') {
    return {
      id: template,
      label: 'Performance Management',
      description: 'Mentor weekly and monthly goals, review feedback, and placement progress.',
      tabs: [
        { title: SHEET_TAB.PERFORMANCE_PLANS, headers: PERFORMANCE_PLAN_HEADERS, filter: true },
        { title: SHEET_TAB.WEEKLY_GOALS, headers: WEEKLY_GOAL_HEADERS, filter: true },
      ],
    };
  }

  return {
    id: template,
    label: 'Central System',
    description: 'PlacementHQ users, batches, sheet registry, audit log, and system configuration.',
    tabs: [
      { title: SHEET_TAB.USERS, headers: ['id', 'name', 'email', 'role', 'status', 'active', 'password_hash', 'last_login_at', 'created_at', 'updated_at', 'team_role', 'team_nickname', 'discord_username', 'discord_user_id'], filter: true },
      { title: SHEET_TAB.BATCHES, headers: ['id', 'batch', 'name', 'project', 'status', 'start_date', 'end_date', 'created_at', 'updated_at', 'active'], filter: true },
      { title: SHEET_TAB.REGISTRY, headers: ['id', 'domain', 'spreadsheet_id', 'spreadsheet_title', 'worksheet_name', 'access_mode', 'status', 'protected_headers', 'attached_by', 'attached_at', 'updated_at', 'active', 'batch'], filter: true },
      { title: SHEET_TAB.AUDIT_LOG, headers: ['id', 'actor_email', 'actor_role', 'action', 'target_type', 'target_id', 'metadata', 'created_at'], filter: true },
      { title: SHEET_TAB.PLACEMENT_FOLLOWUPS, headers: PLACEMENT_FOLLOWUP_HEADERS, filter: true },
      { title: SHEET_TAB.SYSTEM_CONFIG, headers: ['key', 'value', 'description'], rows: configRows(template, createdAt) },
    ],
  };
}

export function validateWorkbookTemplate(template: WorkbookTemplate): WorkbookTemplate {
  if (template.tabs.length === 0) throw new Error('Workbook template must contain at least one worksheet.');
  const titles = new Set<string>();
  for (const tab of template.tabs) {
    if (!tab.title?.trim()) throw new Error(`Workbook template ${template.id} contains a worksheet without a title.`);
    if (titles.has(tab.title)) throw new Error(`Workbook template ${template.id} contains duplicate worksheet title ${tab.title}.`);
    if (tab.headers.length === 0) throw new Error(`Worksheet ${tab.title} must contain at least one header.`);
    titles.add(tab.title);
  }
  return template;
}
