// NexView Candidate Screening Matrix & Interview Types

export type RatingLevel = 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';

export type ProblemSolvingStatus = 'solved' | 'partially_solved' | 'cant_solve';

export type FinalRecommendation =
  | 'Strongly Recommended (Potential Candidate)'
  | 'Recommended'
  | 'Need Improvement'
  | 'Not Recommended';

export type InterviewStatus =
  | 'Pending'
  | 'Assigned'
  | 'Interview Started'
  | 'Draft Saved'
  | 'Completed'
  | 'Cancelled';

export type QuestionStatus = 'solved' | 'partial' | 'cant_solve' | 'unanswered';

export interface GradedQuestion {
  id: string;
  text: string;
  status: QuestionStatus;
  comment?: string;
}

export interface TechnicalSection {
  id: string;
  label: string;
  questions: GradedQuestion[];
  notes?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  course: string;
  batch: string;
  level?: string;
  slot?: string;
  assignedInstructor?: string;
  source: 'google_sheet' | 'manual';
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface Feedback {
  id: string;
  interviewId: string;
  status: 'draft' | 'final';

  // Language Proficiency
  bengaliLevel?: RatingLevel;
  englishLevel?: RatingLevel;
  bengaliComment?: string;
  englishComment?: string;

  // Camera & Environment
  cameraOn: boolean;
  eyeContact?: RatingLevel;
  backgroundLevel?: RatingLevel;
  cameraComment?: string;

  // Soft Skills & Problem Solving
  interpersonalLevel?: RatingLevel;
  interpersonalComment?: string;
  problemSolvingLevel?: ProblemSolvingStatus;
  problemSolvingComment?: string;

  // Technical Evaluation
  experienceLevel?: 'Fresher' | 'Intermediate' | 'Experienced';
  technicalEvaluation: TechnicalSection[];

  // Final Verdict
  finalRecommendation?: FinalRecommendation;
  finalComment?: string;
  submittedAt?: string;
}

export interface Interview {
  id: string;
  studentId: string;
  student: Student;
  instructorName?: string;
  course: string;
  batch: string;
  status: InterviewStatus;
  startedAt?: string;
  completedAt?: string;
  cancelledReason?: string;
  feedback?: Feedback;
}

export interface CourseTemplateCategory {
  id: string;
  label: string;
  suggestions: string[];
}

export interface CourseTemplate {
  course: string;
  showProblemSolving: boolean;
  categories: CourseTemplateCategory[];
}

export interface NexViewExportRow {
  studentName: string;
  email: string;
  phone: string;
  course: string;
  slotOrBatch: string;
  status: string;
  interpersonalSkills: string;
  languageProficiency: string;
  cameraAndEnvironment: string;
  technicalSolved: string;
  technicalPartiallySolved: string;
  technicalCantSolve: string;
  problemSolving: string;
  finalRecommendation: string;
  generalFeedback: string;
}
