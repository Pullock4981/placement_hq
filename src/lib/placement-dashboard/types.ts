export type DashboardRole = 'manager' | 'mentor' | 'student';

export type MetricTone = 'indigo' | 'emerald' | 'amber' | 'sky';

export interface PlacementMetric {
  label: string;
  value: string;
  change: string;
  context: string;
  tone: MetricTone;
}

export interface PipelineStage {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface FollowUpItem {
  student: string;
  batch: string;
  mentor: string;
  reason: string;
  overdueBy: string;
  priority: 'Critical' | 'High' | 'Medium';
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  subject: string;
  time: string;
  type: 'placement' | 'interview' | 'import' | 'access';
}

export interface SheetConnection {
  name: string;
  description: string;
  status: 'Ready to connect' | 'Template available' | 'Planned';
  owner: DashboardRole;
}

export interface ManagerDashboardData {
  metrics: PlacementMetric[];
  pipeline: PipelineStage[];
  followUps: FollowUpItem[];
  activity: ActivityItem[];
  connections: SheetConnection[];
  lastRefreshed: string;
}
