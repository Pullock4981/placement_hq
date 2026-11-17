import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StudentRequestStatus } from '@/lib/student-requests/mock-store';

const statusConfig: Record<StudentRequestStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' },
  under_review: { label: 'Under review', className: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300' },
  changes_requested: { label: 'Changes requested', className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300' },
  approved: { label: 'Approved', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' },
  rejected: { label: 'Rejected', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' },
};

export function RequestStatusBadge({ status, className }: { status: StudentRequestStatus; className?: string }) {
  const config = statusConfig[status];
  return <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide', config.className, className)}>{config.label}</Badge>;
}
