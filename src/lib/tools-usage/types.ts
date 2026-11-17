export interface ToolUsageRecord {
  id: string;
  toolId: string;
  toolName: string;
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'manager' | 'mentor';
  actionType: 'single_audit' | 'batch_audit' | 'preview';
  candidateCount: number;
  timestamp: string; // ISO string
  notes?: string;
}

export interface ToolStatItem {
  toolId: string;
  toolName: string;
  totalUsage: number;
  singleCount: number;
  batchCount: number;
  candidatesAudited: number;
  lastUsed: string;
  percentage: number;
  color: string;
}

export interface UserToolStatItem {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'manager' | 'mentor';
  totalUsage: number;
  candidatesAudited: number;
  lastActive: string;
  toolBreakdown: Record<string, number>;
  primaryTool: string;
}

export interface ToolUsageSummary {
  totalExecutions: number;
  totalCandidatesAudited: number;
  uniqueUsersCount: number;
  topTool: {
    toolName: string;
    count: number;
  };
  toolStats: ToolStatItem[];
  userStats: UserToolStatItem[];
  recentActivity: ToolUsageRecord[];
}
