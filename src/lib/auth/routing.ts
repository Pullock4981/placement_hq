import type { UserRole } from '@/types';
import { USER_ROLE } from '@/constants';

export function dashboardPathForRole(role: UserRole): string {
  if (role === USER_ROLE.ADMIN) return '/admin/users';
  if (role === USER_ROLE.MANAGER) return '/manager';
  return '/mentor';
}
