import Link from 'next/link';
import { ArrowRight, Clock3, Mail, Plus, Search, UserRound } from 'lucide-react';
import { RequestStatusBadge } from '@/components/student-requests/request-status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { StudentRequest } from '@/lib/student-requests/mock-store';

export function StudentRequestList({ requests, role }: { requests: StudentRequest[]; role: 'mentor' | 'manager' }) {
  const detailBase = role === 'manager' ? '/manager/students/requests' : '/mentor/students/requests';
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 rounded-xl pl-9" placeholder="Search by student, email, batch, or request ID…" /></div>
        <div className="flex gap-2"><Badge variant="outline" className="rounded-full px-3">{requests.length} total</Badge><Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">{requests.filter((item) => item.status === 'pending').length} pending</Badge></div>
      </div>
      <div className="grid gap-3">
        {requests.map((request) => (
          <Link key={request.id} href={`${detailBase}/${request.id}`} className="group">
            <Card className="gap-0 border-0 py-0 shadow-sm ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-primary/35 hover:shadow-md">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{request.full_name}</p><RequestStatusBadge status={request.status} /></div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {request.student_email}</span><span>{request.batch}</span><span>{request.project}</span></div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{request.id}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" /> {new Date(request.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {role === 'mentor' && <Link href="/mentor/students/new" className="fixed bottom-6 right-6 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-xl transition-transform hover:-translate-y-0.5 lg:hidden"><Plus className="h-4 w-4" /> Add student</Link>}
    </div>
  );
}
