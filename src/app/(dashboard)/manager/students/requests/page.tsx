import { ClipboardCheck, Clock3, ShieldCheck } from 'lucide-react';
import { StudentRequestList } from '@/components/student-requests/student-request-list';
import { Card, CardContent } from '@/components/ui/card';
import { listStudentRequests } from '@/lib/student-requests/mock-store';

export default function ManagerStudentRequestsPage() {
  const requests = listStudentRequests();
  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const reviewCount = requests.filter((request) => request.status === 'under_review').length;
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 animate-fade-up">
      <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Manager workspace</p><h1 className="mt-2 text-2xl font-black tracking-tight">Student verification</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review mentor submissions before creating active placement records.</p></div>
      <div className="grid gap-3 sm:grid-cols-3"><Summary icon={Clock3} label="Waiting for review" value={pendingCount} /><Summary icon={ClipboardCheck} label="Under review" value={reviewCount} /><Summary icon={ShieldCheck} label="Total submissions" value={requests.length} /></div>
      <StudentRequestList requests={requests} role="manager" />
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: number }) {
  return <Card className="gap-0 border-0 py-4 ring-1 ring-border"><CardContent className="flex items-center gap-3 px-4"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] font-semibold text-muted-foreground">{label}</p></div></CardContent></Card>;
}
