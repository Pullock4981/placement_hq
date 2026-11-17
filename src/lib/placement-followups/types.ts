export type FollowupMilestone = 45 | 90;
export type EmploymentStage = 'still_employed' | 'left_role' | 'between_jobs' | 'other';

export interface PlacementFollowupRecord {
  id: string;
  placement_id: string;
  milestone_days: FollowupMilestone;
  mentor_id: string;
  mentor_email: string;
  mentor_name: string;
  candidate_name: string;
  candidate_email: string;
  company_name: string;
  position: string;
  placement_date: string;
  status: 'sent' | 'responded';
  email_subject: string;
  email_body: string;
  response_token_hash: string;
  sent_from: string;
  provider_message_id: string;
  sent_at: string;
  response_status: EmploymentStage | '';
  response_reason: string;
  responded_at: string;
  created_at: string;
  updated_at: string;
}

export interface FollowupCandidate {
  placement_id: string;
  name: string;
  email: string;
  company: string;
  position: string;
  placement_date: string;
  days_since_placement: number;
  followups: Partial<Record<FollowupMilestone, PlacementFollowupRecord>>;
}

export interface PlacementFollowupWorkspaceData {
  candidates: FollowupCandidate[];
  sender: { connected: boolean; email: string | null; canSendGmail: boolean; centralEmail: string; mentorEmail: string };
}
