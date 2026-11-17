'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'mentor';
  team_role?: string;
  team_nickname?: string;
  discord_username?: string;
  discord_user_id?: string;
}

const demoUser: User = {
  id: 'demo-manager',
  email: 'manager@programming-hero.com',
  name: 'Maliha Chowdhury',
  role: 'manager',
};

const demoMentor: User = {
  id: 'demo-mentor',
  email: 'mentor@programming-hero.com',
  name: 'Afsana Rahman',
  role: 'mentor',
};

export function useAuth() {
  const pathname = usePathname();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const activeDemoUser = pathname.startsWith('/mentor') ? demoMentor : demoUser;
  const { data, isLoading, error } = useQuery<{ user: User }>({
    queryKey: ['auth', isDemoMode ? activeDemoUser.role : 'session'],
    queryFn: async () => {
      let response = await fetch('/api/auth/me');
      if (response.status === 401) {
        const refreshResponse = await fetch('/api/auth/refresh', { method: 'POST' });
        if (refreshResponse.ok) response = await fetch('/api/auth/me');
      }
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return response.json();
    },
    retry: false,
    enabled: !isDemoMode,
    initialData: isDemoMode ? { user: activeDemoUser } : undefined,
  });

  return {
    user: data?.user,
    isLoading,
    isAuthenticated: !error && !isLoading && !!data?.user,
    isDemoMode,
  };
}
