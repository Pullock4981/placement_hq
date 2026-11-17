export type MatchStatus = 'strong' | 'moderate' | 'missing';

export interface SkillItem {
  name: string;
  aliases: string[];
  category: string;
  domain: string;
}

export interface SkillEvaluation {
  skill: string;
  category: 'must-have' | 'nice-to-have';
  status: MatchStatus;
  points: number; // 1.0 (strong), 0.6 (moderate), 0.0 (missing)
  matchedKeyword?: string;
  isCritical?: boolean;
}

export type DecisionBracket =
  | 'good-to-go'
  | 'waiting-list'
  | 'partial-match'
  | 'weak-fit'
  | 'critical-mismatch';

export interface DecisionInfo {
  bracket: DecisionBracket;
  label: string;
  description: string;
  badgeClass: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
}

export interface PenaltiesBreakdown {
  criticalMissing: {
    count: number;
    deduction: number;
    skills: string[];
  };
  unrelatedSkills: {
    count: number;
    deduction: number;
    skills: string[];
  };
  experienceGap: {
    requiredYears: number;
    detectedYears: number;
    meetsRequirement: boolean;
  };
  totalDeduction: number;
}

export interface AtsRubricScore {
  score: number; // 0 - 100
  structureScore: number;
  contactInfoPresent: boolean;
  experiencePresent: boolean;
  projectsPresent: boolean;
  skillsPresent: boolean;
  bulletPointsCount: number;
  wordCount: number;
  feedback: string[];
}

export interface ScreeningResult {
  candidateId?: string;
  candidateName: string;
  batch: string;
  driveLinkOrText: string;
  
  // Scores
  mustHaveScore: number;     // MHS (0-100)
  niceToHaveScore: number;   // NTHS (0-100)
  skillMatchScore: number;   // MS (0-100)
  atsScore: number;          // ATS (0-100)
  baseScore: number;         // (MS * 0.8) + (ATS * 0.2)
  penalties: PenaltiesBreakdown;
  finalScore: number;        // Clamped 0-100

  // Decision
  decision: DecisionInfo;

  // Breakdown
  mustHaveEvaluations: SkillEvaluation[];
  niceToHaveEvaluations: SkillEvaluation[];
  detectedExperienceYears: number;
  experienceSummary: string;
  unrelatedSkillsDetected: string[];
  atsRubric: AtsRubricScore;
  timestamp: string;
}

export interface ScreeningParams {
  candidateName: string;
  batch: string;
  jobDescription: string;
  resumeInput: string; // Google drive link or raw resume text
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  minExperienceYears: number;
}

export interface BatchCandidateRow {
  id: string;
  name: string;
  batch: string;
  resumeInput: string;
  customMustHave?: string[];
  customNiceToHave?: string[];
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ScreeningResult;
}

