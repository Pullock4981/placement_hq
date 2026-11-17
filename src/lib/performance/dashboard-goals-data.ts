import 'server-only';

import { listMonthlyKpiGoals } from '@/lib/performance/sheets';
import { getAllUsers } from '@/lib/sheets/users';
import type { DashboardMonthlyGoal } from '@/lib/performance/dashboard-goals';

export async function getDashboardMonthlyGoals(month: string): Promise<DashboardMonthlyGoal[]> {
  const [records, users] = await Promise.all([listMonthlyKpiGoals(month), getAllUsers()]);
  const normalize = (value: string) => value.trim().toLowerCase();
  return records.map(({ user_id, user_email, user_name, title, target_value, metric, unit, approval_status, discord_user_id, discord_username }) => {
    const profile = users.find((user) => user.id === user_id) || users.find((user) => normalize(user.email) === normalize(user_email));
    const resolvedDiscordUsername = profile?.discord_username || discord_username || '';
    return {
      user_id,
      user_email: profile?.email || user_email,
      user_name: profile?.name || user_name,
      mentor_name: resolvedDiscordUsername || profile?.name || user_name,
      title,
      target_value,
      metric,
      unit,
      approval_status: approval_status.trim().toLowerCase(),
      discord_user_id: (profile?.discord_user_id || discord_user_id || '').trim(),
      discord_username: resolvedDiscordUsername.replace(/^@/, '').trim(),
    };
  });
}
