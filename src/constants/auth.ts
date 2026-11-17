export const USER_ROLE = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MENTOR: 'mentor',
} as const;

export const USER_ROLES = [USER_ROLE.ADMIN, USER_ROLE.MANAGER, USER_ROLE.MENTOR] as const;
export const TEAM_ROLE = { MENTOR: 'mentor', PROJECT: 'project', TECHNICAL: 'technical', ANALYTICS: 'analytics', PARTNER: 'partner', MANAGER: 'manager' } as const;
export const TEAM_ROLES = [TEAM_ROLE.MENTOR, TEAM_ROLE.PROJECT, TEAM_ROLE.TECHNICAL, TEAM_ROLE.ANALYTICS, TEAM_ROLE.PARTNER, TEAM_ROLE.MANAGER] as const;
export const TEAM_ROLE_OPTIONS = [
  { value: TEAM_ROLE.MENTOR, label: 'Mentor', nickname: 'Delta', accessRole: USER_ROLE.MENTOR },
  { value: TEAM_ROLE.PROJECT, label: 'Project', nickname: 'Alpha', accessRole: USER_ROLE.MENTOR },
  { value: TEAM_ROLE.TECHNICAL, label: 'Technical', nickname: 'Nexen', accessRole: USER_ROLE.MENTOR },
  { value: TEAM_ROLE.ANALYTICS, label: 'Analytics', nickname: 'SuperNova', accessRole: USER_ROLE.MENTOR },
  { value: TEAM_ROLE.PARTNER, label: 'Partner', nickname: 'PRM', accessRole: USER_ROLE.MENTOR },
  { value: TEAM_ROLE.MANAGER, label: 'Manager', nickname: 'Management', accessRole: USER_ROLE.MANAGER },
] as const;
export const REGISTRATION_TEAM_ROLE_OPTIONS = TEAM_ROLE_OPTIONS.filter((option) => option.value !== TEAM_ROLE.MANAGER);
export const REGISTRATION_TEAM_ROLES = [TEAM_ROLE.MENTOR, TEAM_ROLE.PROJECT, TEAM_ROLE.TECHNICAL, TEAM_ROLE.ANALYTICS, TEAM_ROLE.PARTNER] as const;
export const TEAM_ROLE_LABELS = Object.fromEntries(TEAM_ROLE_OPTIONS.map((option) => [option.value, option.label])) as Record<(typeof TEAM_ROLES)[number], string>;
export const TEAM_ROLE_NICKNAMES = Object.fromEntries(TEAM_ROLE_OPTIONS.map((option) => [option.value, option.nickname])) as Record<(typeof TEAM_ROLES)[number], string>;
export const REGISTRATION_ROLES = [USER_ROLE.MANAGER, USER_ROLE.MENTOR] as const;

export const USER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export const USER_STATUSES = [USER_STATUS.PENDING, USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED] as const;

export const USER_ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  [USER_ROLE.ADMIN]: 'Admin',
  [USER_ROLE.MANAGER]: 'Manager',
  [USER_ROLE.MENTOR]: 'Mentor',
};

export const USER_STATUS_LABELS: Record<(typeof USER_STATUSES)[number], string> = {
  [USER_STATUS.PENDING]: 'Pending',
  [USER_STATUS.ACTIVE]: 'Active',
  [USER_STATUS.SUSPENDED]: 'Suspended',
};

