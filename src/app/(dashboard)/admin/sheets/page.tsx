import { LockKeyhole } from 'lucide-react';
import { GoogleOAuthConnection } from '@/components/sheets/google-oauth-connection';
import { GoogleSheetProvisioner } from '@/components/sheets/google-sheet-provisioner';
import { SheetAttachmentManager } from '@/components/sheets/sheet-attachment-manager';
import { MentorStudentSheetRegistry } from '@/components/sheets/mentor-student-sheet-registry';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';

export default function AdminSheetManagementPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 animate-fade-up">
      <DashboardPageHeader eyebrow="Programming Hero · Admin Workspace" title="Sheet Management" description="Create, register, and maintain private operational workbooks from one protected Admin workspace." />
      <GoogleOAuthConnection />
      <GoogleSheetProvisioner />
      <MentorStudentSheetRegistry />
      <div className="flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/35 dark:text-indigo-100"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Admin-controlled credentials</p><p className="mt-1 text-xs leading-5 opacity-75">Google credentials and complete spreadsheet IDs stay in private server-side storage.</p></div></div>
      <SheetAttachmentManager />
    </div>
  );
}
