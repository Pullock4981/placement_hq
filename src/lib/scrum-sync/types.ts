export interface ScrumUpdate {
  discord_message_id: string;
  posted_at: string;
  update_date: string;
  week_key: string;
  employee_discord_id: string;
  employee_name: string;
  employee_email: string;
  yesterday: string;
  today: string;
  blockers: string;
  raw_message: string;
  parse_status: string;
  parse_errors: string;
  discord_message_url: string;
  synced_at: string;
  updated_at: string;
}

export interface ScrumSyncRequest {
  fromDate: string;
  toDate: string;
  cursor?: string;
  runId: string;
}

export interface ScrumSyncPage {
  runId: string;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  ignored: number;
  nextCursor: string | null;
  complete: boolean;
}

export interface ScrumDashboardData {
  year: number;
  connectionReady: boolean;
  sheetsReady: boolean;
  discordConfigured: boolean;
  missingProperties: string[];
  spreadsheetTitle: string | null;
  syncedWeeks: number[];
  selectedWeekSynced: boolean;
  lastSyncedAt: string | null;
  records: ScrumUpdate[];
  employees: Array<{ id: string; name: string; email: string }>;
}

