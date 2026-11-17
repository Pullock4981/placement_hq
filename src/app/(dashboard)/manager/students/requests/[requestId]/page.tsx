import { notFound } from 'next/navigation';
import { StudentRequestDetail } from '@/components/student-requests/student-request-detail';
import { getStudentRequest } from '@/lib/student-requests/mock-store';

export default function ManagerStudentRequestDetailPage({ params }: { params: { requestId: string } }) {
  const request = getStudentRequest(params.requestId);
  if (!request) notFound();
  return <StudentRequestDetail request={request} role="manager" />;
}
