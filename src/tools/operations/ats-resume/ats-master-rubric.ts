/**
 * ATS Resume Checker - 100 Marks Master Rubric Engine
 * 
 * Category Marks Breakdown:
 * 1. Parsing Structure: 25 Marks
 * 2. Section Organization: 15 Marks
 * 3. Content Summary Quality: 20 Marks
 * 4. Experience Bullet Quality: 15 Marks
 * 5. Skills Keyword Relevance: 15 Marks
 * 6. Contact Professional Info: 5 Marks
 * 7. Formatting Risk: 5 Marks
 * Total: 100 Marks
 * 
 * Final Status:
 * >= 80: ATS Friendly (High ATS Compatibility)
 * 60 - 79: Needs Work (Moderate ATS Compatibility)
 * < 60: High Risk (Critical Flag — Low Compatibility)
 */

export interface AtsCategoryScore {
  name: string;
  nameBn: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  details: string[];
}

export interface AtsAuditResult {
  totalScore: number; // 0 - 100
  grade: 'ATS Friendly' | 'Needs Work' | 'High Risk';
  gradeBn: string;
  gradeBadgeClass: string;
  isFriendly: boolean;

  // Breakdown across 7 Master Rubric Categories
  categories: {
    parsingStructure: AtsCategoryScore;
    sectionOrganization: AtsCategoryScore;
    contentSummaryQuality: AtsCategoryScore;
    experienceBulletQuality: AtsCategoryScore;
    skillsRelevance: AtsCategoryScore;
    contactInfo: AtsCategoryScore;
    formattingRisk: AtsCategoryScore;
  };

  // Detected Metadata
  metrics: {
    charCount: number;
    lineCount: number;
    wordCount: number;
    detectedSections: string[];
    missingSections: string[];
    actionVerbsFound: string[];
    quantifiableMetricsFound: string[];
    clichesFound: string[];
    weakPhrasesFound: string[];
    skillsFound: string[];
    prohibitedInfoFound: string[];
    hasEmail: boolean;
    hasPhone: boolean;
    hasLinkedIn: boolean;
  };

  recommendations: string[];
}

// Master Keywords & Dictionaries
const STANDARD_ACTION_VERBS = [
  'built', 'optimized', 'engineered', 'developed', 'implemented', 'architected',
  'designed', 'delivered', 'scaled', 'created', 'launched', 'spearheaded',
  'refactored', 'accelerated', 'resolved', 'automated', 'integrated', 'maintained',
  'reduced', 'increased', 'generated', 'transformed', 'deployed', 'programmed',
  'formulated', 'collaborated', 'led', 'managed', 'supervised', 'authored'
];

const CLICHE_PHRASES = [
  'hardworking professional',
  'hardworking',
  'hard working',
  'team player',
  'go-getter',
  'go getter',
  'results-driven',
  'results driven',
  'self-starter',
  'self starter',
  'fast learner',
  'quick learner',
  'detail-oriented',
  'detail oriented',
  'think outside the box',
  'dynamic professional',
  'enthusiastic learner',
  'passionate developer',
  'highly motivated',
  'synergy'
];

const WEAK_PASSIVE_PHRASES = [
  'responsible for',
  'duties included',
  'worked on',
  'helped with',
  'assisted in',
  'tasked with',
  'helped to'
];

const COMMON_TECH_SKILLS = [
  'react', 'next.js', 'javascript', 'typescript', 'node.js', 'express',
  'html', 'html5', 'css', 'css3', 'tailwind', 'tailwind css', 'sass',
  'redux', 'redux toolkit', 'zustand', 'rest api', 'rest apis', 'graphql',
  'mongodb', 'postgresql', 'mysql', 'sql', 'prisma', 'mongoose',
  'git', 'github', 'docker', 'kubernetes', 'aws', 'vercel', 'firebase',
  'python', 'django', 'fastapi', 'java', 'spring', 'c++', 'c#', '.net',
  'ci/cd', 'unit testing', 'jest', 'cypress', 'responsive web design', 'seo'
];

const PROHIBITED_PERSONAL_INFO_PATTERNS = [
  { label: 'Date of Birth (DOB)', regex: /\b(?:dob|date\s*of\s*birth|birth\s*date|জন্ম\s*তারিখ)\b/i },
  { label: 'Marital Status', regex: /\b(?:marital\s*status|married|unmarried|single|বৈবাহিক\s*অবস্থা)\b/i },
  { label: 'Religion', regex: /\b(?:religion|islam|hindu|christian|buddhist|ধর্ম)\b/i },
  { label: 'National ID (NID)', regex: /\b(?:nid|national\s*id|জাতীয়\s*পরিচয়পত্র)\b/i },
  { label: "Father's / Mother's Name", regex: /\b(?:father'?s\s*name|mother'?s\s*name|পিতার\s*নাম|মাতার\s*নাম)\b/i },
];

/**
 * Evaluates Resume against the 100 Marks Master Rubric
 */
export function evaluateAtsMasterRubric(
  resumeText: string,
  targetJobRole = 'Frontend / Full Stack Developer',
): AtsAuditResult {
  const cleanText = (resumeText || '').trim();
  const lowerText = cleanText.toLowerCase();
  const lines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const words = cleanText.split(/\s+/).filter(Boolean);
  const charCount = cleanText.length;
  const lineCount = lines.length;
  const wordCount = words.length;

  const recommendations: string[] = [];

  // ==========================================
  // 1. Parsing Structure (Max: 25 Marks)
  // ==========================================
  let parsingScore = 0;
  const parsingDetails: string[] = [];

  if (charCount < 100) {
    parsingScore = 0;
    parsingDetails.push('Text length is less than 100 characters (0 marks)');
    recommendations.push('Resume file is empty or incomplete. Please ensure sufficient text content.');
  } else {
    if (charCount >= 200) {
      parsingScore += 10;
      parsingDetails.push('Text length ≥200 characters (+10)');
    }
    if (charCount >= 500) {
      parsingScore += 10;
      parsingDetails.push('Text length ≥500 characters (+10)');
    }
    if (lineCount >= 10) {
      parsingScore += 5;
      parsingDetails.push('Total lines ≥10 (+5)');
    }
  }

  // ==========================================
  // 2. Section Organization (Max: 15 Marks)
  // ==========================================
  let sectionScore = 0;
  const sectionDetails: string[] = [];
  const detectedSections: string[] = [];
  const missingSections: string[] = [];

  // Line-by-line or regex header normalization
  const hasExperienceHeader = /\b(experience|work\s+history|employment|work\s+experience|professional\s+experience)\b/i.test(lowerText);
  const hasEducationHeader = /\b(education|academic\s+background|qualifications|academic\s+history)\b/i.test(lowerText);
  const hasSkillsHeader = /\b(skills|technical\s+skills|technologies|proficiencies|tech\s+stack|core\s+competencies)\b/i.test(lowerText);
  const hasProjectsOrSummary = /\b(projects|personal\s+projects|portfolio|summary|professional\s+summary|profile|about\s+me)\b/i.test(lowerText);

  if (hasExperienceHeader) {
    sectionScore += 4;
    detectedSections.push('Experience');
    sectionDetails.push('Experience section header detected (+4)');
  } else {
    missingSections.push('Experience');
    recommendations.push('Add a clear "Experience" or "Work History" section header.');
  }

  if (hasEducationHeader) {
    sectionScore += 4;
    detectedSections.push('Education');
    sectionDetails.push('Education section header detected (+4)');
  } else {
    missingSections.push('Education');
    recommendations.push('Add a clear "Education" or "Academic Background" section header.');
  }

  if (hasSkillsHeader) {
    sectionScore += 4;
    detectedSections.push('Skills');
    sectionDetails.push('Skills section header detected (+4)');
  } else {
    missingSections.push('Skills');
    recommendations.push('Add a clear "Technical Skills" section header.');
  }

  if (hasProjectsOrSummary) {
    sectionScore += 3;
    detectedSections.push('Projects / Summary');
    sectionDetails.push('Projects or Summary section detected (+3)');
  } else {
    missingSections.push('Projects / Summary');
    recommendations.push('Add a "Projects" or "Professional Summary" section header.');
  }

  // ==========================================
  // 3. Content Summary Quality (Max: 20 Marks)
  // ==========================================
  let summaryScore = 0;
  const summaryDetails: string[] = [];
  const clichesFound: string[] = [];

  const hasSummarySection = /\b(summary|professional\s+summary|profile|about\s+me|career\s+objective)\b/i.test(lowerText);
  if (hasSummarySection) {
    summaryScore += 10;
    summaryDetails.push('Summary / Profile / About Me section detected (+10)');
  } else {
    recommendations.push('Add a concise 2-3 line professional summary at the top of your resume.');
  }

  // Cliché phrase check
  for (const phrase of CLICHE_PHRASES) {
    if (lowerText.includes(phrase)) {
      clichesFound.push(phrase);
    }
  }

  if (clichesFound.length === 0) {
    summaryScore += 10;
    summaryDetails.push('No generic or cliché buzzwords detected (+10)');
  } else {
    summaryScore += 5;
    summaryDetails.push(`Cliché buzzwords detected (${clichesFound.slice(0, 2).join(', ')}) (+5)`);
    recommendations.push(`"${clichesFound.slice(0, 3).join(', ')}" Remove generic buzzwords and describe quantifiable work impact.`);
  }

  // ==========================================
  // 4. Experience Bullet Quality (Max: 15 Marks)
  // ==========================================
  let expQualityScore = 0;
  const expQualityDetails: string[] = [];
  const actionVerbsFound: string[] = [];
  const quantifiableMetricsFound: string[] = [];
  const weakPhrasesFound: string[] = [];

  // Strong Action Verbs
  for (const verb of STANDARD_ACTION_VERBS) {
    const rx = new RegExp(`\\b${verb}\\b`, 'i');
    if (rx.test(cleanText) && !actionVerbsFound.includes(verb)) {
      actionVerbsFound.push(verb);
    }
  }

  if (actionVerbsFound.length >= 3) {
    expQualityScore += 6;
    expQualityDetails.push(`3 or more strong action verbs found (${actionVerbsFound.slice(0, 3).join(', ')}) (+6)`);
  } else if (actionVerbsFound.length >= 1) {
    expQualityScore += 3;
    expQualityDetails.push(`Strong action verbs found (${actionVerbsFound.join(', ')}) (+3)`);
    recommendations.push('Use strong action verbs (Built, Optimized, Engineered) at the start of bullet points.');
  } else {
    recommendations.push('Include at least 3 strong action verbs (Developed, Built, Optimized) in your work descriptions.');
  }

  // Quantifiable metrics (% or numbers with impact)
  const metricRegex = /\b\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?|\b\d+x\b|\b\d+\s*(?:k|m|million|billion|users|clients|requests|ms|seconds|minutes)\b|\b\d+\+/gi;
  const metricMatches = cleanText.match(metricRegex) || [];
  metricMatches.forEach((m) => {
    const cleanM = m.trim();
    if (!quantifiableMetricsFound.includes(cleanM)) quantifiableMetricsFound.push(cleanM);
  });

  if (quantifiableMetricsFound.length >= 2) {
    expQualityScore += 6;
    expQualityDetails.push(`2 or more quantifiable metrics/numbers found (+6)`);
  } else if (quantifiableMetricsFound.length >= 1) {
    expQualityScore += 3;
    expQualityDetails.push(`1 quantifiable metric found (+3)`);
    recommendations.push('Add measurable metrics or percentages to demonstrate impact (e.g., Improved speed by 30%, Handled 10K+ requests).');
  } else {
    recommendations.push('Include measurable numbers or percentages (%) in your experience bullet points.');
  }

  // Weak passive phrases
  for (const weak of WEAK_PASSIVE_PHRASES) {
    if (lowerText.includes(weak)) {
      weakPhrasesFound.push(weak);
    }
  }

  if (weakPhrasesFound.length === 0) {
    expQualityScore += 3;
    expQualityDetails.push('No weak passive phrases detected (+3)');
  } else {
    recommendations.push(`"${weakPhrasesFound.slice(0, 2).join(', ')}" Avoid passive phrases and start bullet points directly with active action verbs.`);
  }

  // ==========================================
  // 5. Skills Keyword Relevance (Max: 15 Marks)
  // ==========================================
  let skillsScore = 0;
  const skillsDetails: string[] = [];
  const skillsFound: string[] = [];

  for (const skill of COMMON_TECH_SKILLS) {
    const rx = new RegExp(`\\b${skill.replace(/[.+]/g, '\\$&')}\\b`, 'i');
    if (rx.test(lowerText) && !skillsFound.includes(skill)) {
      skillsFound.push(skill);
    }
  }

  if (skillsFound.length >= 5) {
    skillsScore = 15;
    skillsDetails.push(`5 or more relevant skills identified (${skillsFound.length} Skills) (+15)`);
  } else if (skillsFound.length >= 3) {
    skillsScore = 12;
    skillsDetails.push(`3 to 4 relevant skills identified (${skillsFound.length} Skills) (+12)`);
    recommendations.push('Add more relevant technical skills aligned with your target role.');
  } else if (skillsFound.length >= 1) {
    skillsScore = 8;
    skillsDetails.push(`1 to 2 skills identified (${skillsFound.length} Skills) (+8)`);
    recommendations.push('Expand your technical skill set with modern industry tools.');
  } else {
    skillsScore = 3;
    skillsDetails.push('No standard technical skills detected (+3)');
    recommendations.push('Explicitly list core technical skills (React, JavaScript, Node.js, Git).');
  }

  // ==========================================
  // 6. Contact Professional Info (Max: 5 Marks)
  // ==========================================
  let contactScore = 0;
  const contactDetails: string[] = [];

  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleanText);
  const hasPhone = /(?:\+?880|01|\+?1|\b)[0-9]{9,14}\b/.test(cleanText.replace(/[\s-]/g, ''));
  const hasLinkedIn = /(?:linkedin\.com\/in\/[a-zA-Z0-9_-]+|linkedin\.com)/i.test(cleanText);

  if (hasEmail) {
    contactScore += 2;
    contactDetails.push('Valid professional email format detected (+2)');
  } else {
    recommendations.push('Include a valid professional email address.');
  }

  if (hasPhone) {
    contactScore += 2;
    contactDetails.push('Direct contact phone number detected (+2)');
  } else {
    recommendations.push('Include a direct contact phone number.');
  }

  if (hasLinkedIn) {
    contactScore += 1;
    contactDetails.push('LinkedIn profile link detected (+1)');
  } else {
    recommendations.push('Include your LinkedIn profile link.');
  }

  // ==========================================
  // 7. Formatting Risk (Max: 5 Marks)
  // ==========================================
  const formattingDetails: string[] = [];
  const prohibitedInfoFound: string[] = [];

  for (const item of PROHIBITED_PERSONAL_INFO_PATTERNS) {
    if (item.regex.test(cleanText)) {
      prohibitedInfoFound.push(item.label);
    }
  }

  const prohibitedCount = prohibitedInfoFound.length;
  // Deduct 2 marks per prohibited item from 5
  const formattingScore = Math.max(0, 5 - prohibitedCount * 2);

  if (prohibitedCount === 0) {
    formattingDetails.push('No unnecessary personal details detected (+5)');
  } else {
    formattingDetails.push(`Unnecessary personal info detected: ${prohibitedInfoFound.join(', ')} (-${prohibitedCount * 2} mark deduction)`);
    recommendations.push(`Remove unnecessary personal details (${prohibitedInfoFound.join(', ')}) to conform with international ATS standards.`);
  }

  // ==========================================
  // Final Score & Status Calculation (Sum to 100)
  // ==========================================
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      parsingScore +
        sectionScore +
        summaryScore +
        expQualityScore +
        skillsScore +
        contactScore +
        formattingScore,
    ),
  );

  let grade: 'ATS Friendly' | 'Needs Work' | 'High Risk' = 'ATS Friendly';
  let gradeBn = 'ATS Friendly (High Compatibility)';
  let gradeBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300';
  let isFriendly = true;

  if (totalScore >= 80) {
    grade = 'ATS Friendly';
    gradeBn = 'ATS Friendly (High ATS Compatibility)';
    gradeBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300';
    isFriendly = true;
  } else if (totalScore >= 60) {
    grade = 'Needs Work';
    gradeBn = 'Needs Work (Moderate ATS Compatibility)';
    gradeBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300';
    isFriendly = false;
  } else {
    grade = 'High Risk';
    gradeBn = 'High Risk (Critical Flag — Low ATS Compatibility)';
    gradeBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300';
    isFriendly = false;
  }

  return {
    totalScore,
    grade,
    gradeBn,
    gradeBadgeClass,
    isFriendly,
    categories: {
      parsingStructure: {
        name: 'Parsing Structure',
        nameBn: 'Parsing & Text Structure',
        score: parsingScore,
        maxScore: 25,
        percentage: Math.round((parsingScore / 25) * 100),
        status: parsingScore >= 20 ? 'excellent' : parsingScore >= 15 ? 'good' : 'warning',
        details: parsingDetails,
      },
      sectionOrganization: {
        name: 'Section Organization',
        nameBn: 'Section Organization & Headers',
        score: sectionScore,
        maxScore: 15,
        percentage: Math.round((sectionScore / 15) * 100),
        status: sectionScore >= 12 ? 'excellent' : sectionScore >= 8 ? 'good' : 'warning',
        details: sectionDetails,
      },
      contentSummaryQuality: {
        name: 'Content Summary Quality',
        nameBn: 'Professional Summary Quality',
        score: summaryScore,
        maxScore: 20,
        percentage: Math.round((summaryScore / 20) * 100),
        status: summaryScore >= 15 ? 'excellent' : summaryScore >= 10 ? 'good' : 'warning',
        details: summaryDetails,
      },
      experienceBulletQuality: {
        name: 'Experience Bullet Quality',
        nameBn: 'Action Verbs & Impact Metrics',
        score: expQualityScore,
        maxScore: 15,
        percentage: Math.round((expQualityScore / 15) * 100),
        status: expQualityScore >= 12 ? 'excellent' : expQualityScore >= 8 ? 'good' : 'warning',
        details: expQualityDetails,
      },
      skillsRelevance: {
        name: 'Skills Keyword Relevance',
        nameBn: 'Tech Skills Keyword Matching',
        score: skillsScore,
        maxScore: 15,
        percentage: Math.round((skillsScore / 15) * 100),
        status: skillsScore >= 12 ? 'excellent' : skillsScore >= 8 ? 'good' : 'warning',
        details: skillsDetails,
      },
      contactInfo: {
        name: 'Contact Professional Info',
        nameBn: 'Professional Contact Information',
        score: contactScore,
        maxScore: 5,
        percentage: Math.round((contactScore / 5) * 100),
        status: contactScore >= 4 ? 'excellent' : 'warning',
        details: contactDetails,
      },
      formattingRisk: {
        name: 'Formatting Risk',
        nameBn: 'Formatting & Personal Info Risk',
        score: formattingScore,
        maxScore: 5,
        percentage: Math.round((formattingScore / 5) * 100),
        status: formattingScore >= 5 ? 'excellent' : formattingScore >= 3 ? 'warning' : 'critical',
        details: formattingDetails,
      },
    },
    metrics: {
      charCount,
      lineCount,
      wordCount,
      detectedSections,
      missingSections,
      actionVerbsFound,
      quantifiableMetricsFound,
      clichesFound,
      weakPhrasesFound,
      skillsFound,
      prohibitedInfoFound,
      hasEmail,
      hasPhone,
      hasLinkedIn,
    },
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ['Outstanding! The resume strictly follows international ATS compatibility standards.'],
  };
}

