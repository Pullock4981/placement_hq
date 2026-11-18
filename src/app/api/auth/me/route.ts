import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';

export async function GET(request: Request) {
  const user = getUserFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json(
      { message: 'Not authenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
