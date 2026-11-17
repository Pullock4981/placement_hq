import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { StudentRequestList } from '@/components/student-requests/student-request-list';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { listStudentRequests } from '@/lib/student-requests/mock-store';

export default function MentorStudentRequestsPage() {
  const requests = listStudentRequests().filter((request) => request.mentor_email === 'mentor@programming-hero.com');
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Verification workflow</p><h1 className="mt-2 text-2xl font-black tracking-tight">Student requests</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track students you submitted and respond when a manager requests changes.</p></div>
        <Link href="/mentor/students/new" className={cn(buttonVariants({ size: 'lg' }), 'hidden h-10 gap-2 rounded-xl px-4 sm:inline-flex')}><Plus className="h-4 w-4" /> Add student</Link>
      </div>
      <StudentRequestList requests={requests} role="mentor" />
    </div>
  );
}
