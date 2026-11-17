import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { getAllUsersForAdmin, updateUserAccess } from '@/lib/sheets/users';
import { USER_ROLES, USER_STATUSES } from '@/constants';
import type { UserRole, UserStatus } from '@/types';

export async function GET(request: Request) {
  try {
    const actor = requireRole(request.headers, ['admin', 'manager']);
    const users = await getAllUsersForAdmin();
    const visibleUsers = actor.role === 'manager'
      ? users.filter((user) => user.role !== 'admin')
      : users;
    return NextResponse.json({ data: visibleUsers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return NextResponse.json({ message: apiError.message ?? 'Unable to load users.' }, { status: apiError.status ?? 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = requireRole(request.headers, ['admin', 'manager']);
    const body = await request.json().catch(() => null) as { id?: string; role?: UserRole; status?: UserStatus; active?: boolean } | null;
    if (!body?.id || !USER_ROLES.includes(body.role as UserRole) || !USER_STATUSES.includes(body.status as UserStatus) || typeof body.active !== 'boolean') return NextResponse.json({ message: 'Invalid user update.' }, { status: 400 });
    if (actor.role === 'manager') {
      const target = (await getAllUsersForAdmin()).find((user) => user.id === body.id);
      if (!target) return NextResponse.json({ message: 'User not found.' }, { status: 404 });
      if (target.role === 'admin' || body.role === 'admin') return NextResponse.json({ message: 'Managers cannot change Admin accounts or grant Admin access.' }, { status: 403 });
      if (body.id === actor.id && (!body.active || body.status !== 'active' || body.role !== 'manager')) return NextResponse.json({ message: 'You cannot remove your own Manager access.' }, { status: 400 });
    }
    if (body.id === actor.id && actor.role === 'admin' && (!body.active || body.status !== 'active' || body.role !== 'admin')) return NextResponse.json({ message: 'You cannot remove your own Admin access.' }, { status: 400 });
    const role = USER_ROLES.includes(body.role as UserRole) ? body.role as UserRole : 'mentor';
    const user = await updateUserAccess(body.id, { role, status: body.status as UserStatus, active: body.active });
    return NextResponse.json({ data: user });
  } catch (error) {
    const apiError = error as { message?: string; status?: number };
    return NextResponse.json({ message: apiError.message ?? 'Unable to update user.' }, { status: apiError.status ?? 500 });
  }
}
