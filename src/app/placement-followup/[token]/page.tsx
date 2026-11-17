import { notFound } from 'next/navigation';
import { BriefcaseBusiness } from 'lucide-react';
import { StudentFollowupForm } from '@/components/placement-followups/student-followup-form';
import { getFollowupByToken } from '@/lib/placement-followups/sheets';

export const dynamic = 'force-dynamic';

export default async function PlacementFollowupPage({ params }: { params: { token: string } }) {
  const record = await getFollowupByToken(params.token);
  if (!record) notFound();
  return <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 px-4 py-10 dark:from-slate-950 dark:via-background dark:to-violet-950/30"><div className="mx-auto max-w-2xl"><div className="mb-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white"><BriefcaseBusiness className="h-5 w-5" /></span><div><p className="font-black">Programming Hero</p><p className="text-xs text-muted-foreground">Placement Team · Employment follow-up</p></div></div><section className="rounded-3xl border bg-card p-6 shadow-xl shadow-violet-100/50 dark:shadow-none sm:p-9"><StudentFollowupForm token={params.token} candidateName={record.candidate_name} companyName={record.company_name} milestone={record.milestone_days} alreadyResponded={Boolean(record.responded_at)} /></section><p className="mt-5 text-center text-xs text-muted-foreground">This secure link is intended only for the named candidate.</p></div></main>;
}
