import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { dashboardPathForRole } from '@/lib/auth/routing';

export default async function RootIndexPage() {
  const token = cookies().get('access_token')?.value;

  if (!token) {
    redirect('/login');
  }

  try {
    const payload = await verifyAccessToken(token);
    redirect(dashboardPathForRole(payload.role));
  } catch {
    redirect('/login');
  }
}
