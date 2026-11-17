'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { RHFSelect, RHFTextarea } from '@/components/forms/rhf-fields';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import type { StudentRequestStatus } from '@/lib/student-requests/mock-store';

const ReviewSchema = z.object({
  status: z.enum(['under_review', 'changes_requested', 'approved', 'rejected']),
  review_note: z.string().trim().max(500, 'Keep the review note under 500 characters'),
});

type ReviewInput = z.infer<typeof ReviewSchema>;

export function StudentReviewForm({ requestId, currentStatus, currentNote }: { requestId: string; currentStatus: StudentRequestStatus; currentNote?: string }) {
  const router = useRouter();
  const form = useForm<ReviewInput>({
    resolver: zodResolver(ReviewSchema),
    defaultValues: { status: currentStatus === 'pending' ? 'under_review' : currentStatus as ReviewInput['status'], review_note: currentNote ?? '' },
  });

  const onSubmit = async (values: ReviewInput) => {
    const response = await fetch(`/api/student-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      toast.error('Unable to update this request');
      return;
    }
    toast.success('Verification decision saved');
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <RHFSelect control={form.control} name="status" label="Verification decision" options={[{ label: 'Under review', value: 'under_review' }, { label: 'Request changes', value: 'changes_requested' }, { label: 'Approve student', value: 'approved' }, { label: 'Reject request', value: 'rejected' }]} required />
        <RHFTextarea control={form.control} name="review_note" label="Review note" placeholder="Explain the decision or list the required changes…" />
        <Button type="submit" className="h-10 w-full gap-2 rounded-xl" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save decision</Button>
      </form>
    </Form>
  );
}
