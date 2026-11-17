'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, ExternalLink, Link2, Loader2, LockKeyhole, Mail, MailCheck, Send, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { FollowupCandidate, FollowupMilestone, PlacementFollowupWorkspaceData } from '@/lib/placement-followups/types';
import { bulkFollowupTemplate, defaultFollowupTemplate } from '@/lib/placement-followups/templates';

type SendItem = { placement_id: string; milestone: FollowupMilestone; subject?: string; body?: string; recipient_override?: string };
type SendPayload = { items: SendItem[]; cc: string[] };

function emailList(value: string) {
  return value.split(/[;,\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function request(method: 'GET' | 'POST', body?: unknown) {
  const makeRequest = () => fetch('/api/placement-followups', { method, cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let response = await makeRequest();
  if (response.status === 401) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    if (refresh.ok) response = await makeRequest();
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Placement follow-up request failed.');
  return payload;
}

export function PlacementFollowupsWorkspace() {
  const queryClient = useQueryClient();
  const [milestone, setMilestone] = useState<FollowupMilestone>(45);
  const [selected, setSelected] = useState<string[]>([]);
  const [composerCandidates, setComposerCandidates] = useState<FollowupCandidate[]>([]);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const query = useQuery<PlacementFollowupWorkspaceData>({ queryKey: ['placement-followups'], queryFn: async () => (await request('GET')).data, staleTime: 30_000 });
  const candidates = useMemo(() => query.data?.candidates ?? [], [query.data?.candidates]);
  const visible = useMemo(() => candidates.filter((candidate) => candidate.days_since_placement >= milestone), [candidates, milestone]);
  const selectable = useMemo(() => visible.filter((candidate) => candidate.email && !candidate.followups[milestone]), [visible, milestone]);
  const sentCount = visible.filter((candidate) => Boolean(candidate.followups[milestone])).length;
  const mutation = useMutation({
    mutationFn: (payload: SendPayload) => request('POST', payload),
    onSuccess: (payload) => {
      toast.success(payload.message);
      if (payload.failed?.length) toast.warning(`${payload.failed.length} email${payload.failed.length === 1 ? '' : 's'} could not be delivered. The remaining queue continued.`);
      setSelected([]); setComposerCandidates([]);
      queryClient.invalidateQueries({ queryKey: ['placement-followups'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function openPreview(candidate: FollowupCandidate) {
    const content = defaultFollowupTemplate(candidate, milestone);
    setComposerCandidates([candidate]); setTo(candidate.email); setCc(query.data?.sender.mentorEmail || ''); setSubject(content.subject); setBody(content.body);
  }
  function openBulkComposer() {
    const candidatesToSend = selectable.filter((candidate) => selected.includes(candidate.placement_id));
    if (!candidatesToSend.length) return;
    const content = bulkFollowupTemplate(milestone);
    setComposerCandidates(candidatesToSend); setTo(candidatesToSend.map((candidate) => candidate.email).join(', ')); setCc(query.data?.sender.mentorEmail || ''); setSubject(content.subject); setBody(content.body);
  }
  function changeMilestone(value: FollowupMilestone) { setMilestone(value); setSelected([]); setComposerCandidates([]); }
  function sendComposedEmail() {
    const recipients = emailList(to);
    const ccRecipients = Array.from(new Set(emailList(cc)));
    if (!recipients.length || recipients.some((email) => !validEmail(email))) { toast.error('Enter valid recipient email addresses.'); return; }
    if (ccRecipients.some((email) => !validEmail(email))) { toast.error('Enter valid CC email addresses.'); return; }
    const development = process.env.NODE_ENV !== 'production';
    if (development && recipients.length !== 1 && recipients.length !== composerCandidates.length) {
      toast.error('Use one test email for all messages, or one email per selected candidate.'); return;
    }
    const items = composerCandidates.map((candidate, index) => ({
      placement_id: candidate.placement_id,
      milestone,
      subject: subject.trim(),
      body: body.trim(),
      ...(development ? { recipient_override: recipients.length === 1 ? recipients[0] : recipients[index] } : {}),
    }));
    mutation.mutate({ items, cc: ccRecipients });
  }
  const allSelected = selectable.length > 0 && selectable.every((candidate) => selected.includes(candidate.placement_id));
  if (query.isLoading) return <div className="space-y-5"><div className="h-44 animate-pulse rounded-3xl bg-muted" /><div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;
  return <div className="mx-auto max-w-[96rem] space-y-5 pb-10">
    <DashboardPageHeader eyebrow="Programming Hero · Placement Team" title="Placement Follow-ups" description="Check in with placed candidates at 45 and 90 days, then track every response." />
    {query.isError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{query.error instanceof Error ? query.error.message : 'Follow-ups could not be loaded.'}</p>}

    <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
      <Card className="border-blue-200/70 bg-gradient-to-br from-blue-50/80 to-card shadow-sm dark:border-blue-900 dark:from-blue-950/20"><CardContent className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Due candidates</p><p className="mt-2 text-3xl font-black">{selectable.length}</p><p className="mt-1 text-xs text-muted-foreground">Ready for the {milestone}-day check-in</p></CardContent></Card>
      <Card className="border-violet-200/70 bg-gradient-to-br from-violet-50/80 to-card shadow-sm dark:border-violet-900 dark:from-violet-950/20"><CardContent className="p-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">Already contacted</p><p className="mt-2 text-3xl font-black">{sentCount}</p><p className="mt-1 text-xs text-muted-foreground">Selection remains disabled for this milestone</p></CardContent></Card>
      <Card className="border-indigo-200/70 shadow-sm dark:border-indigo-900"><CardContent className="flex h-full flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">Email sender</p><p className="mt-2 font-black">{query.data?.sender.canSendGmail ? query.data.sender.email : query.data?.sender.centralEmail}</p><p className="mt-1 text-xs text-muted-foreground">{query.data?.sender.canSendGmail ? 'Your Gmail is connected.' : 'Central Gmail will be used by default.'}</p></div>{query.data?.sender.canSendGmail ? <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Gmail connected</Badge> : <Button variant="outline" className="border-indigo-300 text-indigo-700" onClick={() => window.location.assign('/api/google/oauth/connect?purpose=gmail')}><Link2 className="h-4 w-4" />Connect Gmail</Button>}</CardContent></Card>
    </section>

    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="flex items-center gap-2 font-black"><UsersRound className="h-4 w-4 text-violet-600" />Candidate follow-up queue</h2><p className="mt-1 text-xs text-muted-foreground">Candidates who completed both follow-ups are automatically hidden.</p></div><div className="flex flex-wrap gap-2"><div className="flex rounded-xl bg-muted p-1">{([45, 90] as const).map((value) => <button key={value} type="button" onClick={() => changeMilestone(value)} className={`rounded-lg px-4 py-2 text-xs font-black transition ${milestone === value ? 'bg-violet-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{value} days</button>)}</div><Button disabled={!selected.length || mutation.isPending} onClick={openBulkComposer}><Send className="h-4 w-4" />{`Send to all selected (${selected.length})`}</Button></div></div>
      {visible.length ? <Table><TableHeader><TableRow><TableHead className="w-12 px-5"><Checkbox aria-label="Select all eligible candidates" checked={allSelected} disabled={!selectable.length} onCheckedChange={(checked) => setSelected(checked ? selectable.map((candidate) => candidate.placement_id) : [])} /></TableHead><TableHead>Candidate</TableHead><TableHead>Company and role</TableHead><TableHead>Placement</TableHead><TableHead>Follow-up status</TableHead><TableHead className="w-32 text-right">Action</TableHead></TableRow></TableHeader><TableBody>{visible.map((candidate) => { const followup = candidate.followups[milestone]; const disabled = Boolean(followup) || !candidate.email; return <TableRow key={candidate.placement_id} className={disabled ? 'bg-muted/20' : undefined}><TableCell className="px-5"><Checkbox aria-label={`Select ${candidate.name}`} checked={selected.includes(candidate.placement_id)} disabled={disabled} onCheckedChange={(checked) => setSelected((current) => checked ? Array.from(new Set(current.concat(candidate.placement_id))) : current.filter((id) => id !== candidate.placement_id))} /></TableCell><TableCell><p className="font-black">{candidate.name}</p><p className="mt-1 text-xs text-muted-foreground">{candidate.email || 'Email unavailable'}</p></TableCell><TableCell><p className="font-bold">{candidate.company || 'Company unavailable'}</p><p className="mt-1 text-xs text-muted-foreground">{candidate.position || 'Role unavailable'}</p></TableCell><TableCell><p className="font-semibold">{format(parseISO(candidate.placement_date), 'MMM d, yyyy')}</p><p className="mt-1 text-xs text-muted-foreground">{candidate.days_since_placement} days ago</p></TableCell><TableCell>{followup ? <div><Badge className={followup.responded_at ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}>{followup.responded_at ? 'Responded' : 'Email sent'}</Badge><p className="mt-1 text-[10px] text-muted-foreground">{format(new Date(followup.responded_at || followup.sent_at), 'MMM d, h:mm a')}</p></div> : <Badge variant="outline" className="border-amber-300 text-amber-700">Ready to send</Badge>}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" disabled={disabled || mutation.isPending} onClick={() => openPreview(candidate)}><Mail className="h-3.5 w-3.5" />Send email</Button></TableCell></TableRow>; })}</TableBody></Table> : <div className="p-12 text-center"><MailCheck className="mx-auto h-10 w-10 text-violet-400" /><h3 className="mt-4 font-black">No {milestone}-day follow-ups are due</h3><p className="mt-2 text-sm text-muted-foreground">New candidates will appear when they reach this placement milestone.</p></div>}
    </section>

    <Dialog open={composerCandidates.length > 0} onOpenChange={(open) => { if (!open) setComposerCandidates([]); }}><DialogContent showCloseButton={false} className="flex h-[min(92dvh,760px)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-3xl"><DialogHeader className="shrink-0 flex-row items-center justify-between border-b bg-gradient-to-r from-violet-700 to-indigo-700 px-4 py-3 text-white sm:px-5 sm:py-4"><div className="min-w-0"><DialogTitle className="flex items-center gap-2 text-base font-black"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><Mail className="h-4 w-4" /></span>New placement follow-up</DialogTitle><DialogDescription className="mt-1 truncate pl-10 text-xs text-violet-100">{composerCandidates.length === 1 ? `${composerCandidates[0]?.name} · ${milestone}-day follow-up` : `${composerCandidates.length} emails queued for individual delivery`}</DialogDescription></div><Button size="icon-sm" variant="ghost" className="shrink-0 text-white hover:bg-white/10 hover:text-white" onClick={() => setComposerCandidates([])}><X className="h-4 w-4" /><span className="sr-only">Close composer</span></Button></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto bg-background"><div className="divide-y border-b px-4 sm:px-5"><div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center py-1.5"><span className="text-xs font-bold text-muted-foreground">From</span><p className="truncate py-2 text-sm font-semibold">{query.data?.sender.canSendGmail ? query.data.sender.email : query.data?.sender.centralEmail}</p></div><div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-start py-2"><label className="pt-2 text-xs font-bold text-muted-foreground">To</label><Textarea aria-label="Send to" value={to} onChange={(event) => setTo(event.target.value)} readOnly={process.env.NODE_ENV === 'production'} className="min-h-10 resize-none border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:ring-0" />{process.env.NODE_ENV !== 'production' && <p className="col-start-2 pb-1 text-[10px] font-semibold text-amber-600">Development mode: replace the recipients with one test email, or one email per candidate.</p>}</div><div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center py-1.5"><label className="text-xs font-bold text-muted-foreground">Cc</label><div className="flex min-w-0 items-center gap-2"><Input aria-label="CC mentor" value={cc} readOnly className="min-w-0 border-0 bg-transparent px-0 font-medium shadow-none focus-visible:ring-0" /><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300"><LockKeyhole className="h-3 w-3" />Mentor</span></div></div><div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center py-1.5"><label className="text-xs font-bold text-muted-foreground">Subject</label><Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} className="min-w-0 border-0 bg-transparent px-0 font-semibold shadow-none focus-visible:ring-0" /></div></div><div className="bg-muted/20 p-3 sm:p-5"><div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"><Textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} className="min-h-64 resize-y border-0 bg-transparent p-0 font-sans leading-7 shadow-none focus-visible:ring-0 sm:min-h-72" /></div><div className="mt-3 flex gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900 dark:border-violet-900 dark:bg-violet-950/25 dark:text-violet-100"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0" /><p>Each queued message is sent separately. Student name, role, company, and mentor name are personalized for every candidate.</p></div></div></div><DialogFooter className="!mx-0 !mb-0 shrink-0 !rounded-none border-t bg-background px-4 py-3 sm:px-5"><div className="mr-auto flex items-center gap-2 text-xs font-semibold text-muted-foreground"><MailCheck className="h-4 w-4 text-violet-600" />{composerCandidates.length === 1 ? 'One email ready' : `${composerCandidates.length} emails · sequential queue`}</div><Button className="w-full sm:w-auto" disabled={mutation.isPending || !composerCandidates.length || subject.trim().length < 3 || body.trim().length < 10 || !to.trim()} onClick={sendComposedEmail}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{mutation.isPending ? `Processing queue…` : composerCandidates.length === 1 ? 'Send email' : `Start queue (${composerCandidates.length})`}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
