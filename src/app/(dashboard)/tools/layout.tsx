'use client';

import React from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell title="Operations Tools">{children}</DashboardShell>;
}

