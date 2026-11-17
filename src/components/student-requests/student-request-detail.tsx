import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, ExternalLink, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { RequestStatusBadge } from '@/components/student-requests/request-status-badge';
import { StudentReviewForm } from '@/components/student-requests/student-review-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentRequest } from '@/lib/student-requests/mock-store';

export function StudentRequestDetail({ request, role }: { request: StudentRequest; role: 'mentor' | 'manager' }) {
  const backHref = role === 'manager' ? '/manager/students/requests' : '/mentor/students/requests';
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 animate-fade-up">
      <div>
        <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to requests</Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-tight">{request.full_name}</h1><RequestStatusBadge status={request.status} /></div><p className="mt-2 text-sm text-muted-foreground">{request.id} · Submitted {new Date(request.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>{role === 'manager' && <p className="flex items-center gap-2 text-xs font-bold text-primary"><ShieldCheck className="h-4 w-4" /> Manager verification workspace</p>}</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="gap-5 border-0 py-5 shadow-sm ring-1 ring-border">
            <CardHeader className="px-5"><CardTitle className="flex items-center gap-2 font-bold"><UserRound className="h-4 w-4 text-primary" /> Student information</CardTitle></CardHeader>
            <CardContent className="grid gap-4 px-5 sm:grid-cols-2"><Detail label="Email" value={request.student_email} icon={Mail} /><Detail label="Phone" value={request.phone} icon={Phone} /><Detail label="Batch" value={request.batch} /><Detail label="Project" value={request.project} /><Detail label="Experience" value={request.experience} /><Detail label="Work preference" value={request.job_focus} /></CardContent>
          </Card>
          <Card className="gap-5 border-0 py-5 shadow-sm ring-1 ring-border">
            <CardHeader className="px-5"><CardTitle className="flex items-center gap-2 font-bold"><BriefcaseBusiness className="h-4 w-4 text-primary" /> Placement readiness</CardTitle></CardHeader>
            <CardContent className="space-y-4 px-5"><ProfileLink label="Portfolio" href={request.portfolio_url} /><ProfileLink label="LinkedIn" href={request.linkedin_url} /><ProfileLink label="GitHub" href={request.github_url} /><div className="rounded-xl bg-muted/45 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Mentor notes</p><p className="mt-2 text-xs leading-5">{request.notes || 'No additional notes provided.'}</p></div></CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          {role === 'manager' ? (
            <Card className="gap-4 border-0 py-5 shadow-sm ring-1 ring-border"><CardHeader className="px-5"><CardTitle className="font-bold">Review request</CardTitle><p className="text-xs leading-5 text-muted-foreground">Approve the student or return clear changes to the mentor.</p></CardHeader><CardContent className="px-5"><StudentReviewForm requestId={request.id} currentStatus={request.status} currentNote={request.review_note} /></CardContent></Card>
          ) : (
            <Card className="gap-4 border-0 py-5 shadow-sm ring-1 ring-border"><CardHeader className="px-5"><CardTitle className="font-bold">Verification status</CardTitle></CardHeader><CardContent className="space-y-3 px-5"><RequestStatusBadge status={request.status} /><p className="text-xs leading-5 text-muted-foreground">Managers review identity, cohort information, consent, and placement readiness before activation.</p>{request.review_note && <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200"><span className="font-bold">Manager note:</span> {request.review_note}</div>}</CardContent></Card>
          )}
          <Card className="gap-3 border-0 py-5 ring-1 ring-border"><CardContent className="space-y-3 px-5"><p className="flex items-center gap-2 text-xs font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Consent confirmed</p><p className="text-[11px] leading-5 text-muted-foreground">Submitted by {request.mentor_name}<br />{request.mentor_email}</p></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Mail }) {
  return <div className="rounded-xl border border-border/70 p-3.5"><p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1.5 flex items-center gap-2 text-xs font-semibold capitalize">{Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}{value}</p></div>;
}

function ProfileLink({ label, href }: { label: string; href: string }) {
  return <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"><span className="text-xs font-bold">{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Open profile <ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-muted-foreground">Not provided</span>}</div>;
}
