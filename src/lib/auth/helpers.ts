import type { JWTPayload, UserRole } from '@/types';

export type ApiError = { message: string; status: number };

export function createApiError(message: string, status: number): ApiError {
  return { message, status };
}

export function getUserFromHeaders(headers: Headers): JWTPayload | null {
  const userId = headers.get('x-user-id');
  const userRole = headers.get('x-user-role') as UserRole | null;
  const userEmail = headers.get('x-user-email');
  const userName = headers.get('x-user-name');
  const teamRole = headers.get('x-user-team-role');
  const teamNickname = headers.get('x-user-team-nickname');
  const discordUsername = headers.get('x-user-discord-username');
  const discordUserId = headers.get('x-user-discord-user-id');

  if (!userId || !userRole || !userEmail || !userName) {
    return null;
  }

  return {
    id: userId,
    role: userRole,
    email: userEmail,
    name: userName,
    ...(teamRole ? { team_role: teamRole as JWTPayload['team_role'] } : {}),
    ...(teamNickname ? { team_nickname: teamNickname } : {}),
    ...(discordUsername ? { discord_username: discordUsername } : {}),
    ...(discordUserId ? { discord_user_id: discordUserId } : {}),
  };
}

export function requireRole(headers: Headers, roles: UserRole[]): JWTPayload {
  const user = getUserFromHeaders(headers);
  
  if (!user) {
    throw createApiError('Unauthorized', 401);
  }

  if (user.role !== 'admin' && !roles.includes(user.role)) {
    throw createApiError('Forbidden: insufficient permissions', 403);
  }

  return user;
}
