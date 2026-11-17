import type { StudentRequestInput } from '@/lib/validators/student-request.schema';

export type StudentRequestStatus = 'pending' | 'under_review' | 'changes_requested' | 'approved' | 'rejected';

export interface StudentRequest extends StudentRequestInput {
  id: string;
  mentor_name: string;
  mentor_email: string;
  status: StudentRequestStatus;
  submitted_at: string;
  reviewed_at?: string;
  reviewer_name?: string;
  review_note?: string;
}

const requests: StudentRequest[] = [
  {
    id: 'REQ-2026-1042',
    full_name: 'Nafisa Rahman',
    student_email: 'nafisa.rahman@example.com',
    phone: '+880 1712-345678',
    batch: 'Batch 11',
    project: 'Endgame',
    experience: 'fresher',
    job_focus: 'remote',
    portfolio_url: 'https://nafisa.dev',
    linkedin_url: 'https://linkedin.com/in/nafisa-rahman',
    github_url: 'https://github.com/nafisa-rahman',
    notes: 'Completed all placement readiness modules and CV review.',
    information_confirmed: true,
    consent_confirmed: true,
    mentor_name: 'Afsana Rahman',
    mentor_email: 'mentor@programming-hero.com',
    status: 'pending',
    submitted_at: '2026-08-24T10:30:00.000Z',
  },
  {
    id: 'REQ-2026-1038',
    full_name: 'Imran Hossain',
    student_email: 'imran.hossain@example.com',
    phone: '+880 1812-987654',
    batch: 'Batch 10',
    project: 'Kaizen',
    experience: 'experienced',
    job_focus: 'hybrid',
    portfolio_url: '',
    linkedin_url: 'https://linkedin.com/in/imran-hossain',
    github_url: 'https://github.com/imran-hossain',
    notes: 'Two years of frontend freelancing experience.',
    information_confirmed: true,
    consent_confirmed: true,
    mentor_name: 'Afsana Rahman',
    mentor_email: 'mentor@programming-hero.com',
    status: 'under_review',
    submitted_at: '2026-08-22T08:15:00.000Z',
    reviewer_name: 'Maliha Chowdhury',
  },
  {
    id: 'REQ-2026-1021',
    full_name: 'Sadia Islam',
    student_email: 'sadia.islam@example.com',
    phone: '+880 1911-223344',
    batch: 'Batch 10',
    project: 'SCPC',
    experience: 'fresher',
    job_focus: 'onsite',
    portfolio_url: '',
    linkedin_url: '',
    github_url: 'https://github.com/sadia-islam',
    notes: 'Ready for placement support.',
    information_confirmed: true,
    consent_confirmed: true,
    mentor_name: 'Farhan Ahmed',
    mentor_email: 'farhan@programming-hero.com',
    status: 'changes_requested',
    submitted_at: '2026-08-18T13:45:00.000Z',
    reviewed_at: '2026-08-19T09:20:00.000Z',
    reviewer_name: 'Maliha Chowdhury',
    review_note: 'Please add the student’s LinkedIn profile and confirm the phone number.',
  },
  {
    id: 'REQ-2026-0997',
    full_name: 'Tanvir Ahmed',
    student_email: 'tanvir.ahmed@example.com',
    phone: '+880 1611-556677',
    batch: 'Batch 9',
    project: 'EAP',
    experience: 'fresher',
    job_focus: 'remote',
    portfolio_url: 'https://tanvir.dev',
    linkedin_url: 'https://linkedin.com/in/tanvir-ahmed',
    github_url: 'https://github.com/tanvir-ahmed',
    notes: '',
    information_confirmed: true,
    consent_confirmed: true,
    mentor_name: 'Farhan Ahmed',
    mentor_email: 'farhan@programming-hero.com',
    status: 'approved',
    submitted_at: '2026-08-12T07:10:00.000Z',
    reviewed_at: '2026-08-13T11:00:00.000Z',
    reviewer_name: 'Maliha Chowdhury',
    review_note: 'Verified against Batch 9 records.',
  },
];

export function listStudentRequests() {
  return [...requests];
}

export function getStudentRequest(id: string) {
  return requests.find((request) => request.id === id);
}

export function createStudentRequest(input: StudentRequestInput) {
  const request: StudentRequest = {
    ...input,
    id: `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    mentor_name: 'Afsana Rahman',
    mentor_email: 'mentor@programming-hero.com',
    status: 'pending',
    submitted_at: new Date().toISOString(),
  };
  requests.unshift(request);
  return request;
}

export function reviewStudentRequest(id: string, status: StudentRequestStatus, reviewNote?: string) {
  const request = getStudentRequest(id);
  if (!request) return undefined;
  request.status = status;
  request.review_note = reviewNote;
  request.reviewed_at = new Date().toISOString();
  request.reviewer_name = 'Maliha Chowdhury';
  return request;
}
