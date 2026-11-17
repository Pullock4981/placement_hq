'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EmploymentStage } from '@/lib/placement-followups/types';

const OPTIONS: Array<{ value: EmploymentStage; label: string; description: string }> = [
  { value: 'still_employed', label: 'Still employed', description: 'I am continuing in this role.' },
  { value: 'left_role', label: 'Left the role', description: 'I resigned or moved on from the role.' },
  { value: 'between_jobs', label: 'Between jobs', description: 'I am currently looking for another opportunity.' },
  { value: 'other', label: 'Other', description: 'My current situation is different.' },
];

export function StudentFollowupForm({ token, candidateName, companyName, milestone, alreadyResponded }: { token: string; candidateName: string; companyName: string; milestone: number; alreadyResponded: boolean }) {
  const [status, setStatus] = useState<EmploymentStage>('still_employed');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadyResponded);
  const [error, setError] = useState('');
  if (submitted) return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/20"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h2 className="mt-4 text-xl font-black">Thank you for the update</h2><p className="mt-2 text-sm text-muted-foreground">Your response has been securely recorded for the Placement Team.</p></div>;
  async function submit() {
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/placement-followup/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || 'Your response could not be saved.');
      setSubmitted(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your response could not be saved.'); }
    finally { setSubmitting(false); }
  }
  return <div className="space-y-6"><div><p className="text-sm font-bold text-violet-700 dark:text-violet-300">{milestone}-day placement check-in</p><h1 className="mt-2 text-3xl font-black tracking-tight">Hello, {candidateName}.</h1><p className="mt-3 leading-7 text-muted-foreground">Please tell us about your current employment situation{companyName ? ` at ${companyName}` : ''}.</p></div><div className="grid gap-3 sm:grid-cols-2">{OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={cn('rounded-2xl border p-4 text-left transition', status === option.value ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-900' : 'hover:border-violet-300')}><span className="font-black">{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span></button>)}</div><div><label className="mb-2 block text-sm font-bold">Brief reason or update {status === 'still_employed' ? '(optional)' : '(required)'}</label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className="min-h-28" placeholder="Share any useful context about your role or transition." /></div>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button className="h-12 w-full bg-violet-600 font-bold text-white hover:bg-violet-700" disabled={submitting || (status !== 'still_employed' && reason.trim().length < 3)} onClick={() => void submit()}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Submit employment update</Button></div>;
}
