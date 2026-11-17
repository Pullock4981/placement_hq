/**
 * Experience Detection Engine
 * Accurately extracts work experience years and duration from resume text,
 * properly ignoring academic/education degrees and prioritizing professional tenure.
 */

export interface ExperienceDetectionResult {
  detectedYears: number;
  summary: string;
  matchedSpans: string[];
}

export function detectExperience(resumeText: string): ExperienceDetectionResult {
  if (!resumeText || resumeText.trim().length === 0) {
    return {
      detectedYears: 0,
      summary: 'No work experience (Fresher / Entry level)',
      matchedSpans: [],
    };
  }

  const currentYear = new Date().getFullYear();
  const matchedSpans: string[] = [];

  // Check for explicit "fresher / entry-level / intern / student" indicators
  const isExplicitFresher =
    /\b(fresher|entry[- ]level|seeking first role|graduate trainee|no prior experience)\b/i.test(
      resumeText,
    );

  // 1. Explicit years declaration (e.g., "3 years of experience", "2.5+ years experience", "1+ year experience")
  const explicitYearsRegex =
    /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:professional|hands-on|work|industry|software development|engineering))?\s*experience/gi;
  let explicitMatch: RegExpExecArray | null;
  let maxExplicitYears = 0;

  while ((explicitMatch = explicitYearsRegex.exec(resumeText)) !== null) {
    const yrs = parseFloat(explicitMatch[1]);
    if (yrs > maxExplicitYears && yrs <= 30) {
      maxExplicitYears = yrs;
      matchedSpans.push(explicitMatch[0]);
    }
  }

  // 2. Section-Aware Date Range Detection
  // Split resume by lines and strip out academic education blocks to avoid counting university degrees as work experience!
  const lines = resumeText.split(/\r?\n/);
  let currentSection: 'header' | 'experience' | 'education' | 'skills' | 'projects' | 'other' =
    'header';
  const experienceLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect major section transitions
    if (
      /^(?:work\s+)?experience|employment|work history|professional experience|professional background/i.test(
        trimmed,
      )
    ) {
      currentSection = 'experience';
      continue;
    } else if (
      /^education|academic background|academic qualifications|university|degrees|college|educational background/i.test(
        trimmed,
      )
    ) {
      currentSection = 'education';
      continue;
    } else if (/^projects|portfolio|personal projects|key projects/i.test(trimmed)) {
      currentSection = 'projects';
      continue;
    } else if (/^skills|technical skills|proficiencies|languages/i.test(trimmed)) {
      currentSection = 'skills';
      continue;
    }

    // Only collect lines from experience, projects, or top header summary (EXCLUDING education)
    if (
      currentSection === 'experience' ||
      currentSection === 'projects' ||
      currentSection === 'header'
    ) {
      // Also skip individual lines mentioning degree/b.sc/bachelor/hsc/ssc/diploma
      if (!/\b(b\.?sc|bachelor|diploma|hsc|ssc|m\.?sc|master|university|college|gpa|cgpa)\b/i.test(trimmed)) {
        experienceLines.push(trimmed);
      }
    }
  }

  const experienceText = experienceLines.length > 0 ? experienceLines.join('\n') : resumeText;

  // Year range regex: e.g. "Jan 2022 - Present", "2021 to 2024", "2023 - Current"
  const yearRangeRegex =
    /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(20\d{2}|19\d{2})\s*(?:-|–|—|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(20\d{2}|19\d{2})|(present|current|now))/gi;

  const detectedRanges: { start: number; end: number }[] = [];
  let rangeMatch: RegExpExecArray | null;

  while ((rangeMatch = yearRangeRegex.exec(experienceText)) !== null) {
    const startYear = parseInt(rangeMatch[1], 10);
    const endStr = rangeMatch[2]?.toLowerCase() || rangeMatch[3]?.toLowerCase();
    const endYear =
      endStr === 'present' || endStr === 'current' || endStr === 'now'
        ? currentYear
        : parseInt(endStr, 10);

    if (startYear <= endYear && startYear >= 1995 && endYear <= currentYear) {
      detectedRanges.push({ start: startYear, end: endYear });
      matchedSpans.push(rangeMatch[0]);
    }
  }

  // Merge overlapping work experience ranges
  let calculatedYearsFromDates = 0;
  if (detectedRanges.length > 0) {
    detectedRanges.sort((a, b) => a.start - b.start);
    let currentStart = detectedRanges[0].start;
    let currentEnd = detectedRanges[0].end;

    for (let i = 1; i < detectedRanges.length; i++) {
      if (detectedRanges[i].start <= currentEnd) {
        currentEnd = Math.max(currentEnd, detectedRanges[i].end);
      } else {
        calculatedYearsFromDates += currentEnd - currentStart;
        currentStart = detectedRanges[i].start;
        currentEnd = detectedRanges[i].end;
      }
    }
    calculatedYearsFromDates += currentEnd - currentStart;
  }

  // Choose the most accurate estimate:
  // If candidate explicitly specified their experience, prioritize it over date range span!
  let finalYears = 0;
  if (maxExplicitYears > 0) {
    finalYears = maxExplicitYears;
  } else if (calculatedYearsFromDates > 0) {
    finalYears = calculatedYearsFromDates;
  } else if (isExplicitFresher) {
    finalYears = 0;
  }

  const roundedYears = Math.round(finalYears * 10) / 10;

  let summary = '';
  if (roundedYears === 0) {
    summary = 'Entry Level / Fresher (0 Years Experience)';
  } else if (roundedYears < 1) {
    summary = 'Less than 1 year experience (Internship / Project Level)';
  } else if (roundedYears === 1) {
    summary = '1 year of professional experience';
  } else {
    summary = `${roundedYears} years of professional experience`;
  }

  return {
    detectedYears: roundedYears,
    summary,
    matchedSpans: matchedSpans.slice(0, 5),
  };
}

