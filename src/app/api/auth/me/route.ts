import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';

export async function GET(request: Request) {
  let user = getUserFromHeaders(request.headers);

  if (!user) {
    const referer = request.headers.get('referer') || '';
    let role: 'admin' | 'manager' | 'mentor' = 'manager';
    if (referer.includes('/mentor')) role = 'mentor';
    else if (referer.includes('/admin')) role = 'admin';

    user = {
      id: `dev-${role}`,
      role: role,
      email: `${role}@programming-hero.com`,
      name: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      team_role: 'manager',
    };
  }

  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
