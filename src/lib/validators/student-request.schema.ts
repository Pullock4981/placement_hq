import { z } from 'zod';

const optionalUrl = z.union([z.literal(''), z.string().url('Enter a valid URL')]);

export const StudentRequestSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the student’s full name').max(100),
  student_email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().min(8, 'Enter a valid phone number').max(20),
  batch: z.string().min(1, 'Select a batch'),
  project: z.string().min(1, 'Select a project'),
  experience: z.enum(['fresher', 'experienced'], { message: 'Select an experience level' }),
  job_focus: z.enum(['remote', 'onsite', 'hybrid'], { message: 'Select a job preference' }),
  portfolio_url: optionalUrl,
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  notes: z.string().trim().max(1000, 'Notes must be under 1,000 characters'),
  information_confirmed: z.boolean().refine(Boolean, 'Confirm the information before submitting'),
  consent_confirmed: z.boolean().refine(Boolean, 'Student consent is required'),
});

export type StudentRequestInput = z.infer<typeof StudentRequestSchema>;
