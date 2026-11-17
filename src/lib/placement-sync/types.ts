export interface PlacementSyncRecord {
  discord_message_id: string;
  candidate_name: string;
  candidate_email: string;
  company_name: string;
  position: string;
  job_type: string;
  batch: string;
  course: string;
  project_name: string;
  mentor_name: string;
  mentor_email: string;
  verification_status: string;
  parse_status: string;
  posted_at: string;
  discord_message_url: string;
}

export interface PlacementSyncStatus {
  ingestionVersion?: 1;
  connectionReady: boolean;
  sheetsReady: boolean;
  discordConfigured: boolean;
  syncSupported?: boolean | null;
  missingProperties: string[];
  spreadsheetTitle: string | null;
  spreadsheetUrl: string | null;
  masterRows: number;
  months: string[];
  recentRecords: PlacementSyncRecord[];
  lastSync: Record<string, unknown> | null;
}

export interface PlacementSyncRequest {
  fromDate: string;
  toDate: string;
  cursor?: string;
  runId: string;
}

export interface PlacementSyncCounters {
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  invalid: number;
  ignored: number;
}

export interface PlacementSyncPage extends PlacementSyncCounters {
  runId: string;
  nextCursor: string | null;
  complete: boolean;
}
