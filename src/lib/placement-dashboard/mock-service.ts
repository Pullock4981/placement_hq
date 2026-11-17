import type { ManagerDashboardData } from './types';

const managerDashboardMock: ManagerDashboardData = {
  metrics: [
    { label: 'Active students', value: '1,248', change: '+6.2%', context: 'Across 8 active batches', tone: 'indigo' },
    { label: 'Placed this month', value: '86', change: '+14.7%', context: '12 more than July', tone: 'emerald' },
    { label: 'Placement rate', value: '68.4%', change: '+3.1%', context: 'Goal: 72% this quarter', tone: 'sky' },
    { label: 'Needs attention', value: '37', change: '9 overdue', context: 'Follow-up required today', tone: 'amber' },
  ],
  pipeline: [
    { label: 'Placement ready', value: 438, percentage: 100, color: 'bg-indigo-500' },
    { label: 'Actively applying', value: 316, percentage: 72, color: 'bg-sky-500' },
    { label: 'Interviewing', value: 181, percentage: 41, color: 'bg-violet-500' },
    { label: 'Offer received', value: 74, percentage: 17, color: 'bg-amber-500' },
    { label: 'Placed', value: 52, percentage: 12, color: 'bg-emerald-500' },
  ],
  followUps: [
    { student: 'Nusrat Jahan', batch: 'Batch 10', mentor: 'Farhan Ahmed', reason: 'Interview feedback pending', overdueBy: '3 days', priority: 'Critical' },
    { student: 'Samiul Hasan', batch: 'Batch 9', mentor: 'Afsana Rahman', reason: 'No application activity', overdueBy: '2 days', priority: 'High' },
    { student: 'Tania Sultana', batch: 'Batch 11', mentor: 'Farhan Ahmed', reason: 'CV review requested', overdueBy: '1 day', priority: 'Medium' },
  ],
  activity: [
    { id: 'activity-1', actor: 'Afsana Rahman', action: 'moved', subject: 'Rafi Ahmed to Interviewing', time: '12 min ago', type: 'interview' },
    { id: 'activity-2', actor: 'System', action: 'imported', subject: '126 students from Batch 11', time: '48 min ago', type: 'import' },
    { id: 'activity-3', actor: 'Farhan Ahmed', action: 'recorded a placement for', subject: 'Sadia Karim at Brain Station 23', time: '2 hr ago', type: 'placement' },
    { id: 'activity-4', actor: 'Maliha Chowdhury', action: 'activated access for', subject: 'mentor@programming-hero.com', time: 'Yesterday', type: 'access' },
  ],
  connections: [
    { name: 'Access Control', description: 'Allowed emails, roles, and active status', status: 'Template available', owner: 'manager' },
    { name: 'Placement Information', description: 'Placement stages, interviews, offers, and outcomes', status: 'Ready to connect', owner: 'manager' },
    { name: 'Student Information', description: 'Private student sheets organized by batch', status: 'Ready to connect', owner: 'mentor' },
    { name: 'Company Information', description: 'Hiring partners and open opportunities', status: 'Planned', owner: 'manager' },
    { name: 'Audit Log', description: 'Immutable operational activity history', status: 'Template available', owner: 'manager' },
  ],
  lastRefreshed: 'Mock data · updated 5 minutes ago',
};

export async function getManagerDashboardData(): Promise<ManagerDashboardData> {
  return managerDashboardMock;
}
