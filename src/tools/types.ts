export type ToolBadgeVariant = 'new' | 'live' | 'count' | 'default';

export interface ToolItem {
  id: string;
  title: string;
  description: string;
  iconName: string;
  href: string;
  badge?: string;
  badgeVariant?: ToolBadgeVariant;
  isPrimary?: boolean;
}

export interface PortfolioRubric {
  designAndUI: number;      // Max 15
  projectsQuality: number;  // Max 15
  codeAndGithub: number;    // Max 10
  aboutAndContact: number;  // Max 10
  speedAndSEO: number;      // Max 10
}

export type ScreeningStatus = 'Passed' | 'Needs Revision' | 'Approved' | 'Under Review';

export type ToolType =
  | 'Resume Screening'
  | 'ATS Resume Check'
  | 'GitHub Profile Check'
  | 'Portfolio (60M)'
  | 'AI Assignment Check'
  | 'NexView Tool';

export interface ScreeningHistoryRecord {
  id: string;
  studentName: string;
  batch: string;
  toolUsed: ToolType;
  score: string;
  status: ScreeningStatus;
  date: string;
}

