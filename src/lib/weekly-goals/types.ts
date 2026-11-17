export interface WeeklyGoalComment {
  id: string;
  body: string;
  author_name: string;
  author_email: string;
  created_at: string;
}

export interface WeeklyGoalSubmission {
  id: string;
  week_key: string;
  week_number: number;
  year: number;
  week_start: string;
  week_end: string;
  user_id: string;
  user_email: string;
  user_name: string;
  discord_user_id: string;
  discord_username: string;
  goals: string[];
  comments: WeeklyGoalComment[];
  created_at: string;
  updated_at: string;
}

export interface WeeklyGoalsData {
  week: { key: string; number: number; year: number; start: string; end: string };
  submission: WeeklyGoalSubmission | null;
}
