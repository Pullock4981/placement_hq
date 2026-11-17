/**
 * Resume Screening Engine
 * Implements exact scoring formula, rubric weights, penalty deductions, and decision brackets.
 */

import skillsDict from './skills-dictionary.json';
import {
  DecisionBracket,
  DecisionInfo,
  MatchStatus,
  PenaltiesBreakdown,
  ScreeningParams,
  ScreeningResult,
  SkillEvaluation,
  SkillItem,
} from './types';
import { normalizeText } from './parser';
import { detectExperience } from './experience-detector';
import { evaluateAtsStructure } from './ats-evaluator';

const SKILLS_LIST: SkillItem[] = skillsDict.skills;

/**
 * Returns DecisionInfo with labels and styling based on the final score.
 * Formula:
 * >= 80% with <= 1 missing skill: Good to Go (Directly suitable for interview)
 * >= 2 missing skills OR 70% - 79%: Waiting List (Cannot be Good to Go)
 * 50% - 69%: Partial Match
 * 30% - 49%: Weak Fit
 * < 30%: Critical Mismatch (Direct Rejection)
 */
export function getDecisionBracket(
  score: number,
  hasCriticalMissing = false,
  missingMustHavesCount = 0,
  totalMustHavesCount = 1,
): DecisionInfo {
  // CRITICAL RULE: "1 ta skills missing taile ok but 2 ta skills na thakle taile kokhono e good to go hbe nah"
  // Strictly at most 1 missing skill allowed for Good to Go!
  const isGoodToGo = score >= 80 && !hasCriticalMissing && missingMustHavesCount <= 1;

  if (isGoodToGo) {
    return {
      bracket: 'good-to-go',
      label: 'Good to Go',
      description: 'Highly Recommended for interview (Core criteria met)',
      badgeClass:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      borderClass: 'border-emerald-500/40',
      bgClass: 'bg-emerald-500/10',
    };
  }

  // If 2 or more skills are missing, OR if score is 70% - 79% -> Waiting List!
  if (score >= 70 || missingMustHavesCount >= 2) {
    return {
      bracket: 'waiting-list',
      label: 'Waiting List',
      description:
        missingMustHavesCount >= 2
          ? `${missingMustHavesCount} required skill(s) missing; placed on waiting list`
          : 'Interview Waiting List (Strong potential, meets core criteria)',
      badgeClass:
        'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300',
      textClass: 'text-blue-600 dark:text-blue-400',
      borderClass: 'border-blue-500/40',
      bgClass: 'bg-blue-500/10',
    };
  }

  if (score >= 50) {
    return {
      bracket: 'partial-match',
      label: 'Partial Match',
      description: 'Partial match found (Secondary consideration required)',
      badgeClass:
        'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300',
      textClass: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-500/40',
      bgClass: 'bg-amber-500/10',
    };
  }

  if (score >= 30) {
    return {
      bracket: 'weak-fit',
      label: 'Weak Fit',
      description: 'Lacks required technical skills (Low suitability)',
      badgeClass:
        'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300',
      textClass: 'text-orange-600 dark:text-orange-400',
      borderClass: 'border-orange-500/40',
      bgClass: 'bg-orange-500/10',
    };
  }

  return {
    bracket: 'critical-mismatch',
    label: 'Critical Mismatch',
    description: 'Does not match job requirements (Direct Rejection)',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300',
    textClass: 'text-red-600 dark:text-red-400',
    borderClass: 'border-red-500/40',
    bgClass: 'bg-red-500/10',
  };
}

/**
 * Finds aliases and skill definition for a given skill string.
 */
function findSkillDefinition(skillName: string): SkillItem | undefined {
  const cleanName = skillName.trim().toLowerCase();
  return SKILLS_LIST.find((s) => {
    if (s.name.toLowerCase() === cleanName) return true;
    return s.aliases.some((a) => a.toLowerCase() === cleanName);
  });
}

/**
 * Matches a skill against resume text:
 * - Strong Match: 1.0 points (exact keyword or recognized alias match)
 * - Moderate Match: 0.6 points (partial / substring match)
 * - Missing: 0.0 points
 */
function evaluateSkillMatch(skillName: string, normalizedResume: string): {
  status: MatchStatus;
  points: number;
  matchedKeyword?: string;
} {
  const cleanSkill = skillName.trim().toLowerCase();
  const def = findSkillDefinition(skillName);
  const targetKeywords = def ? [def.name.toLowerCase(), ...def.aliases.map((a) => a.toLowerCase())] : [cleanSkill];

  // 1. Strong Match Check (Exact word boundary)
  for (const kw of targetKeywords) {
    // Escape special regex characters
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
    if (exactRegex.test(normalizedResume)) {
      return { status: 'strong', points: 1.0, matchedKeyword: kw };
    }
  }

  // 2. Moderate Match Check (Substring or token match)
  for (const kw of targetKeywords) {
    if (kw.length >= 3 && normalizedResume.includes(kw)) {
      return { status: 'moderate', points: 0.6, matchedKeyword: kw };
    }
    // Check parts if multi-word (e.g. "REST API" -> "restful" or "apis")
    const parts = kw.split(/\s+/).filter((p) => p.length > 2);
    if (parts.length > 1) {
      const allPartsFound = parts.every((p) => normalizedResume.includes(p));
      if (allPartsFound) {
        return { status: 'moderate', points: 0.6, matchedKeyword: parts.join(' & ') };
      }
    }
  }

  // 3. Missing
  return { status: 'missing', points: 0.0 };
}

/**
 * Automatically extracts recognized technical skills and minimum experience from Job Description text.
 * Intelligently separates Must-Have vs Nice-To-Have / Preferred sections and detects required experience.
 */
export function extractSkillsFromJobDescription(jdText: string): {
  suggestedMustHave: string[];
  suggestedNiceToHave: string[];
  detectedMinExperience: number;
  detectedExperienceText?: string;
  hasPreferredSection: boolean;
  totalSkillsFound: number;
} {
  if (!jdText || typeof jdText !== 'string' || jdText.trim().length === 0) {
    return {
      suggestedMustHave: ['React', 'Next.js', 'TypeScript', 'Node.js'],
      suggestedNiceToHave: ['Tailwind CSS', 'MongoDB', 'Docker'],
      detectedMinExperience: 1,
      hasPreferredSection: false,
      totalSkillsFound: 7,
    };
  }

  // 1. Detect Minimum Experience from JD text
  let detectedMinExperience = 1; // default fallback
  let detectedExperienceText: string | undefined;

  const fresherRegex = /\b(?:fresher|fresh graduate|entry\s*level|no\s*experience\s*required|0\s*years?)\b/i;
  const expRangeRegex = /\b(\d+)\s*(?:-|to)\s*(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/i;
  const expMinRegex = /(?:minimum|min|at least|\+)?\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?(?:professional|relevant|hands-on|industry|software|working)?\s*experience)?/i;
  const expColonRegex = /(?:experience|exp|work experience)\s*:\s*(?:minimum\s*)?(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)/i;

  if (fresherRegex.test(jdText)) {
    detectedMinExperience = 0;
    detectedExperienceText = 'Fresher / Entry level (0 yrs)';
  } else {
    const colonMatch = jdText.match(expColonRegex);
    const rangeMatch = jdText.match(expRangeRegex);
    const minMatch = jdText.match(expMinRegex);

    if (colonMatch) {
      detectedMinExperience = Math.min(10, Math.max(0, Math.round(parseFloat(colonMatch[1]))));
      detectedExperienceText = colonMatch[0].trim();
    } else if (rangeMatch) {
      detectedMinExperience = Math.min(10, Math.max(0, parseInt(rangeMatch[1], 10)));
      detectedExperienceText = rangeMatch[0].trim();
    } else if (minMatch) {
      detectedMinExperience = Math.min(10, Math.max(0, Math.round(parseFloat(minMatch[1]))));
      detectedExperienceText = minMatch[0].trim();
    }
  }

  // 2. Section Splitting: Check for "Preferred", "Nice to have", "Bonus" headers
  const preferredHeaderRegex = /(?:^|\n)\s*(?:preferred skills|preferred qualifications|nice to have|good to have|bonus points?|plus|pluses|additional skills|optional skills)\s*:?/i;
  const preferredMatch = jdText.search(preferredHeaderRegex);

  let coreSection = jdText;
  let preferredSection = '';
  let hasPreferredSection = false;

  if (preferredMatch !== -1) {
    hasPreferredSection = true;
    coreSection = jdText.slice(0, preferredMatch);
    preferredSection = jdText.slice(preferredMatch);
  }

  // Helper to extract skills from a chunk of text
  const extractFromChunk = (chunkText: string): SkillItem[] => {
    const normalizedChunk = chunkText.toLowerCase();
    const found: SkillItem[] = [];

    for (const skill of SKILLS_LIST) {
      const isPresent = skill.aliases.some((alias) => {
        const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
        return regex.test(normalizedChunk);
      });

      if (isPresent && !found.some((f) => f.name === skill.name)) {
        found.push(skill);
      }
    }
    return found;
  };

  const coreSkills = extractFromChunk(coreSection);
  const preferredSkills = preferredSection ? extractFromChunk(preferredSection) : [];

  const uniquePreferred = preferredSkills.filter(
    (p) => !coreSkills.some((c) => c.name === p.name),
  );

  let suggestedMustHave: string[] = [];
  let suggestedNiceToHave: string[] = [];

  if (hasPreferredSection && (coreSkills.length > 0 || uniquePreferred.length > 0)) {
    suggestedMustHave = coreSkills.map((s) => s.name);
    suggestedNiceToHave = uniquePreferred.map((s) => s.name);

    if (suggestedMustHave.length === 0 && suggestedNiceToHave.length > 0) {
      suggestedMustHave = [suggestedNiceToHave[0]];
      suggestedNiceToHave = suggestedNiceToHave.slice(1);
    }
  } else {
    // If no distinct section header, also check for bullet lines with "plus / bonus / familiar with / knowledge of"
    const lines = jdText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const coreDetected: string[] = [];
    const bonusDetected: string[] = [];

    const bonusLinePrefixRegex = /^(?:-|\*|•|\d+\.)?\s*(?:plus|bonus|nice to have|good to have|familiarity with|knowledge of|experience with.*(?:plus|bonus))/i;

    for (const line of lines) {
      const lineSkills = extractFromChunk(line).map((s) => s.name);
      if (bonusLinePrefixRegex.test(line)) {
        for (const sk of lineSkills) {
          if (!bonusDetected.includes(sk) && !coreDetected.includes(sk)) {
            bonusDetected.push(sk);
          }
        }
      } else {
        for (const sk of lineSkills) {
          if (!coreDetected.includes(sk)) {
            coreDetected.push(sk);
          }
        }
      }
    }

    const finalBonus = bonusDetected.filter((b) => !coreDetected.includes(b));

    if (coreDetected.length > 0 || finalBonus.length > 0) {
      suggestedMustHave = coreDetected;
      suggestedNiceToHave = finalBonus;
    } else {
      const allFound = extractFromChunk(jdText);
      if (allFound.length > 0) {
        const pivot = Math.max(1, Math.ceil(allFound.length * 0.65));
        suggestedMustHave = allFound.slice(0, pivot).map((s) => s.name);
        suggestedNiceToHave = allFound.slice(pivot).map((s) => s.name);
      } else {
        suggestedMustHave = ['React', 'JavaScript', 'Node.js'];
        suggestedNiceToHave = ['Git', 'Tailwind CSS'];
      }
    }
  }

  if (suggestedMustHave.length === 0) {
    if (suggestedNiceToHave.length > 0) {
      suggestedMustHave = [suggestedNiceToHave[0]];
      suggestedNiceToHave = suggestedNiceToHave.slice(1);
    } else {
      suggestedMustHave = ['React', 'JavaScript', 'Node.js'];
    }
  }

  const totalSkillsFound = suggestedMustHave.length + suggestedNiceToHave.length;

  return {
    suggestedMustHave,
    suggestedNiceToHave,
    detectedMinExperience,
    detectedExperienceText,
    hasPreferredSection,
    totalSkillsFound,
  };
}

/**
 * Detects extra / irrelevant skills present in the resume that were NOT required by the JD.
 */
function detectUnrelatedSkills(
  normalizedResume: string,
  requiredSkills: string[],
): string[] {
  const requiredLower = new Set(requiredSkills.map((s) => s.toLowerCase()));
  const unrelated: string[] = [];

  // Specifically check skills in other domains (e.g., game engines, mobile apps, legacy systems)
  for (const skill of SKILLS_LIST) {
    const sNameLower = skill.name.toLowerCase();
    if (requiredLower.has(sNameLower)) continue;

    // Check if skill is present in resume
    const isPresent = skill.aliases.some((alias) => {
      const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
      return regex.test(normalizedResume);
    });

    if (isPresent) {
      // Flag if belonging to completely distinct domains or legacy/out-of-scope tools
      if (
        skill.category === 'game' ||
        skill.category === 'mobile' ||
        skill.category === 'cms' ||
        skill.domain === 'legacy-web'
      ) {
        unrelated.push(skill.name);
      }
    }
  }

  return unrelated;
}

/**
 * Main Resume Screening Execution Engine
 */
export function runResumeScreening(params: ScreeningParams): ScreeningResult {
  const {
    candidateName,
    batch,
    jobDescription,
    resumeInput,
    mustHaveSkills,
    niceToHaveSkills,
    minExperienceYears,
  } = params;

  // 0. Check if candidate provided any resume content
  if (!resumeInput || resumeInput.trim().length === 0) {
    const emptyMustHave: SkillEvaluation[] = mustHaveSkills.map((skill) => ({
      skill,
      category: 'must-have',
      status: 'missing',
      points: 0,
      isCritical: true,
    }));

    return {
      candidateName: candidateName || 'Candidate',
      batch: batch || 'Batch 10',
      driveLinkOrText: '',
      mustHaveScore: 0,
      niceToHaveScore: 0,
      skillMatchScore: 0,
      atsScore: 0,
      baseScore: 0,
      penalties: {
        criticalMissing: { count: mustHaveSkills.length, deduction: 10, skills: mustHaveSkills },
        unrelatedSkills: { count: 0, deduction: 0, skills: [] },
        experienceGap: { requiredYears: minExperienceYears, detectedYears: 0, meetsRequirement: false },
        totalDeduction: 10,
      },
      finalScore: 0,
      decision: {
        bracket: 'critical-mismatch',
        label: 'Critical Mismatch',
        description: 'No resume link or file provided (No Resume Submitted)',
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300',
        textClass: 'text-red-600 dark:text-red-400',
        borderClass: 'border-red-500/40',
        bgClass: 'bg-red-500/10',
      },
      mustHaveEvaluations: emptyMustHave,
      niceToHaveEvaluations: [],
      detectedExperienceYears: 0,
      experienceSummary: 'No resume data available (0 Years)',
      unrelatedSkillsDetected: [],
      atsRubric: {
        score: 0,
        structureScore: 0,
        contactInfoPresent: false,
        experiencePresent: false,
        projectsPresent: false,
        skillsPresent: false,
        bulletPointsCount: 0,
        wordCount: 0,
        feedback: ['No resume found or file is empty (No Resume Data)'],
      },
      timestamp: new Date().toISOString(),
    };
  }

  const normalizedResume = normalizeText(resumeInput);

  // 1. Evaluate Must-Have Skills
  const mustHaveEvaluations: SkillEvaluation[] = mustHaveSkills.map((skill, index) => {
    const match = evaluateSkillMatch(skill, normalizedResume);
    return {
      skill,
      category: 'must-have',
      status: match.status,
      points: match.points,
      matchedKeyword: match.matchedKeyword,
      isCritical: index < 2, // First two must-have skills are deemed core/critical
    };
  });

  // 2. Evaluate Nice-To-Have Skills
  const niceToHaveEvaluations: SkillEvaluation[] = niceToHaveSkills.map((skill) => {
    const match = evaluateSkillMatch(skill, normalizedResume);
    return {
      skill,
      category: 'nice-to-have',
      status: match.status,
      points: match.points,
      matchedKeyword: match.matchedKeyword,
    };
  });

  // 3. Must-Have Score (MHS): (Earned Points / Total Count) * 100
  const mustHaveEarnedPoints = mustHaveEvaluations.reduce((sum, item) => sum + item.points, 0);
  const totalMustHaveCount = mustHaveEvaluations.length > 0 ? mustHaveEvaluations.length : 1;
  const mustHaveScore = Math.round((mustHaveEarnedPoints / totalMustHaveCount) * 100);

  // 4. Nice-to-Have Score (NTHS): (Earned Points / Total Count) * 100
  let niceToHaveScore = 0;
  if (niceToHaveEvaluations.length > 0) {
    const niceToHaveEarnedPoints = niceToHaveEvaluations.reduce((sum, item) => sum + item.points, 0);
    niceToHaveScore = Math.round((niceToHaveEarnedPoints / niceToHaveEvaluations.length) * 100);
  }

  // 5. Skill Match Score (MS): (MHS * 0.70) + (NTHS * 0.30), or MHS if only Must-Have
  let skillMatchScore = mustHaveScore;
  if (niceToHaveEvaluations.length > 0) {
    const rawMS = mustHaveScore * 0.70 + niceToHaveScore * 0.30;
    // When candidate fulfills core must-haves (>=80%), optional bonus skills should enhance rather than heavily penalize
    if (mustHaveScore >= 80) {
      // Must-have holds primary core weight (95%-100%); nice-to-have adds bonus points up to 8%
      const bonus = Math.round((niceToHaveScore / 100) * 8);
      skillMatchScore = Math.min(100, Math.max(Math.round(rawMS), mustHaveScore - 2 + bonus));
    } else {
      skillMatchScore = Math.round(rawMS);
    }
  }

  // 6. ATS Resume Structure Evaluation (20% of final score)
  const atsRubric = evaluateAtsStructure(resumeInput);
  const atsScore = atsRubric.score;

  // 7. Base Weighted Score: (MS * 0.80) + (ATS Score * 0.20)
  const baseScore = Math.round(skillMatchScore * 0.80 + atsScore * 0.20);

  // 8. Experience Detection
  const experienceResult = detectExperience(resumeInput);
  const detectedExperienceYears = experienceResult.detectedYears;
  const meetsExperience = detectedExperienceYears >= minExperienceYears;

  // 9. Unrelated / Extra Skills Detection
  const allTargetSkills = [...mustHaveSkills, ...niceToHaveSkills];
  const unrelatedSkillsDetected = detectUnrelatedSkills(normalizedResume, allTargetSkills);

  // 10. Penalties and Deductions
  // Critical Missing: Deduct -10% only if a primary/core Must-Have skill is completely missing (0.0 points)
  const missingCriticalMustHaves = mustHaveEvaluations
    .filter((e) => e.isCritical && e.status === 'missing')
    .map((e) => e.skill);
  const criticalMissingDeduction = missingCriticalMustHaves.length > 0 ? 10 : 0;

  // Extra / Unrelated Skills Penalty: -2% per 2 unrelated skills, max -10%
  const unrelatedPairs = Math.floor(unrelatedSkillsDetected.length / 2);
  const unrelatedSkillsDeduction = Math.min(10, unrelatedPairs * 2);

  const totalDeduction = criticalMissingDeduction + unrelatedSkillsDeduction;

  const penalties: PenaltiesBreakdown = {
    criticalMissing: {
      count: missingCriticalMustHaves.length,
      deduction: criticalMissingDeduction,
      skills: missingCriticalMustHaves,
    },
    unrelatedSkills: {
      count: unrelatedSkillsDetected.length,
      deduction: unrelatedSkillsDeduction,
      skills: unrelatedSkillsDetected,
    },
    experienceGap: {
      requiredYears: minExperienceYears,
      detectedYears: detectedExperienceYears,
      meetsRequirement: meetsExperience,
    },
    totalDeduction,
  };

  // 11. Final Overall Score Calculation (Clamped 0 - 100)
  const rawFinalScore = baseScore - totalDeduction;
  let finalScore = Math.max(0, Math.min(100, rawFinalScore));

  const missingMustHaves = mustHaveEvaluations.filter((e) => e.status === 'missing');
  const hasCriticalMissing = missingCriticalMustHaves.length > 0;

  // USER RULE:
  // "jodi amn hoy shobar e 1 ta skills missing taile ok but 2 ta skills na thakle taile kokhono e good to go hbe nah
  // 90% er upor to na e scor"
  // If 2 or more Must-Have skills are missing, score CANNOT be >= 90%!
  if (missingMustHaves.length >= 2) {
    finalScore = Math.min(84, finalScore);
  }
  if (missingMustHaves.length >= 3) {
    finalScore = Math.min(74, finalScore);
  }
  if (missingMustHaves.length >= 4) {
    finalScore = Math.min(62, finalScore);
  }

  // 12. Decision Bracket Determination
  const decision = getDecisionBracket(
    finalScore,
    hasCriticalMissing,
    missingMustHaves.length,
    mustHaveEvaluations.length,
  );

  return {
    candidateName: candidateName || 'Candidate',
    batch: batch || 'Batch 10',
    driveLinkOrText: resumeInput,
    mustHaveScore,
    niceToHaveScore,
    skillMatchScore,
    atsScore,
    baseScore,
    penalties,
    finalScore,
    decision,
    mustHaveEvaluations,
    niceToHaveEvaluations,
    detectedExperienceYears,
    experienceSummary: experienceResult.summary,
    unrelatedSkillsDetected,
    atsRubric,
    timestamp: new Date().toISOString(),
  };
}

