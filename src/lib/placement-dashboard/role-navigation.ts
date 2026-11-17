import type { DashboardRole } from './types';

interface RoleWorkspace {
  label: string;
  description: string;
  navigation: string[];
}

export const roleWorkspaces: Record<DashboardRole, RoleWorkspace> = {
  manager: {
    label: 'Manager',
    description: 'Program oversight, data administration, access, and reporting',
    navigation: ['Dashboard', 'Students', 'Placement tracker', 'Placement leaderboard', 'Placement sync', 'Companies', 'Imports', 'Sheet management', 'Analytics', 'Access control'],
  },
  mentor: {
    label: 'Mentor',
    description: 'Assigned student progress, follow-ups, attendance, and placement activity',
    navigation: ['My dashboard', 'My students', 'Progress logs', 'Attendance', 'Placement', 'Risk tracker', 'Tasks'],
  },
  student: {
    label: 'Student',
    description: 'Personal placement progress and assigned actions',
    navigation: ['My progress', 'Applications', 'Interviews', 'Tasks', 'Profile'],
  },
};
