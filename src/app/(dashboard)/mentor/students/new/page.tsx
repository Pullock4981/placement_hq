import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { StudentRequestForm } from '@/components/student-requests/student-request-form';

export default function NewStudentRequestPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10 animate-fade-up">
      <div>
        <Link href="/mentor/students/requests" className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Student requests</Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Manager verification required</p><h1 className="mt-2 text-2xl font-black tracking-tight">Add a student</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Submit a student to the placement workspace. A manager will verify the information before the student becomes active.</p></div>
        </div>
      </div>
      <StudentRequestForm />
    </div>
  );
}
