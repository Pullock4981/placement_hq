'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AtSign, BriefcaseBusiness, Code2, Globe2, Loader2, Network, Phone, Send, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { RHFCheckbox, RHFInput, RHFSelect, RHFTextarea } from '@/components/forms/rhf-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { BATCH_NAMES, EXPERIENCE_LEVEL, JOB_FOCUS, PROJECT_NAMES } from '@/constants';
import { StudentRequestSchema, type StudentRequestInput } from '@/lib/validators/student-request.schema';

const batchOptions = BATCH_NAMES.map((value) => ({ label: value, value }));
const projectOptions = PROJECT_NAMES.map((value) => ({ label: value, value }));

const defaultValues: StudentRequestInput = {
  full_name: '',
  student_email: '',
  phone: '',
  batch: '',
  project: '',
  experience: EXPERIENCE_LEVEL.FRESHER,
  job_focus: JOB_FOCUS.REMOTE,
  portfolio_url: '',
  linkedin_url: '',
  github_url: '',
  notes: '',
  information_confirmed: false,
  consent_confirmed: false,
};

export function StudentRequestForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm<StudentRequestInput>({ resolver: zodResolver(StudentRequestSchema), defaultValues, mode: 'onBlur' });

  const onSubmit = async (values: StudentRequestInput) => {
    setSubmitError(undefined);
    try {
      const response = await fetch('/api/student-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to submit the request');
      toast.success('Student submitted for manager verification');
      router.push(`/mentor/students/requests/${payload.data.id}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit the request';
      setSubmitError(message);
      toast.error(message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <Card className="gap-5 border-0 py-6 shadow-sm ring-1 ring-border">
          <CardHeader className="px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"><UserRound className="h-5 w-5" /></div>
              <div><CardTitle className="font-bold">Student information</CardTitle><p className="mt-1 text-xs text-muted-foreground">Basic identity and cohort details used for verification.</p></div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 px-6 md:grid-cols-2">
            <RHFInput control={form.control} name="full_name" label="Full name" placeholder="e.g. Nafisa Rahman" required leadingIcon={<UserRound className="h-4 w-4" />} />
            <RHFInput control={form.control} name="student_email" label="Email address" type="email" placeholder="student@example.com" required leadingIcon={<AtSign className="h-4 w-4" />} />
            <RHFInput control={form.control} name="phone" label="Phone number" type="tel" placeholder="+880 1XXX-XXXXXX" required leadingIcon={<Phone className="h-4 w-4" />} />
            <RHFSelect control={form.control} name="batch" label="Programming Hero batch" options={batchOptions} placeholder="Select a batch" required />
            <RHFSelect control={form.control} name="project" label="Placement project" options={projectOptions} placeholder="Select a project" required />
            <RHFSelect control={form.control} name="experience" label="Experience level" options={[{ label: 'Fresher', value: 'fresher' }, { label: 'Experienced', value: 'experienced' }]} required />
            <RHFSelect control={form.control} name="job_focus" label="Preferred work mode" options={[{ label: 'Remote', value: 'remote' }, { label: 'On-site', value: 'onsite' }, { label: 'Hybrid', value: 'hybrid' }]} required className="md:col-span-2" />
          </CardContent>
        </Card>

        <Card className="gap-5 border-0 py-6 shadow-sm ring-1 ring-border">
          <CardHeader className="px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300"><BriefcaseBusiness className="h-5 w-5" /></div>
              <div><CardTitle className="font-bold">Professional profiles</CardTitle><p className="mt-1 text-xs text-muted-foreground">Optional links help managers confirm placement readiness.</p></div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 px-6 md:grid-cols-2">
            <RHFInput control={form.control} name="portfolio_url" label="Portfolio URL" type="url" placeholder="https://student.dev" leadingIcon={<Globe2 className="h-4 w-4" />} />
            <RHFInput control={form.control} name="linkedin_url" label="LinkedIn URL" type="url" placeholder="https://linkedin.com/in/..." leadingIcon={<Network className="h-4 w-4" />} />
            <RHFInput control={form.control} name="github_url" label="GitHub URL" type="url" placeholder="https://github.com/..." leadingIcon={<Code2 className="h-4 w-4" />} className="md:col-span-2" />
            <RHFTextarea control={form.control} name="notes" label="Mentor notes" placeholder="Add placement readiness, skills, or verification context…" description="Do not include passwords, credentials, or sensitive personal information." className="md:col-span-2" />
          </CardContent>
        </Card>

        <Card className="gap-4 border-0 py-5 shadow-sm ring-1 ring-border">
          <CardContent className="space-y-3 px-5">
            <RHFCheckbox control={form.control} name="information_confirmed" label="Information confirmed" checkboxLabel="I reviewed these details with the student and believe they are accurate." />
            <RHFCheckbox control={form.control} name="consent_confirmed" label="Student consent" checkboxLabel="The student agreed to share this information with the placement operations team." />
            {submitError && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">{submitError}</p>}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={() => router.push('/mentor/students/requests')}>Cancel</Button>
              <Button type="submit" className="h-10 gap-2 rounded-xl px-5" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {form.formState.isSubmitting ? 'Submitting…' : 'Submit for verification'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
