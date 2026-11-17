import {
  Feedback,
  Interview,
  NexViewExportRow,
  TechnicalSection,
  CourseTemplateCategory,
} from './nexview-types';

/**
 * TSV Escaping helper: Prevents multi-line cells and quotes from breaking Google Sheet rows
 */
export const escapeTsvCell = (val: unknown): string => {
  const s = (val ?? '').toString();
  if (s.includes('\t') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Automated Feedback Engine:
 * Computes pass percentage and generates concise, professional candidate summary
 */
export function computeAutoFeedback(
  feedback: Partial<Feedback>,
  studentName = 'Candidate',
): {
  finalComment: string;
  passPercentage: number;
  solvedCount: number;
  partialCount: number;
  cantSolveCount: number;
  totalEvaluated: number;
} {
  const sections: TechnicalSection[] = feedback.technicalEvaluation || [];
  const solvedQuestions: string[] = [];
  const partialQuestions: string[] = [];
  const cantSolveQuestions: string[] = [];

  sections.forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      const qText = q.text.trim();
      if (q.status === 'solved') solvedQuestions.push(qText);
      else if (q.status === 'partial') partialQuestions.push(qText);
      else if (q.status === 'cant_solve') cantSolveQuestions.push(qText);
    });
  });

  const solvedCount = solvedQuestions.length;
  const partialCount = partialQuestions.length;
  const cantSolveCount = cantSolveQuestions.length;
  const totalEvaluated = solvedCount + partialCount + cantSolveCount;

  const passPercentage =
    totalEvaluated > 0 ? Math.round((solvedCount / totalEvaluated) * 100) : 0;

  // 1. Rule-based core sentence
  let summaryCore = '';
  if (totalEvaluated === 0) {
    summaryCore = `${studentName} completed the interview session. General review noted.`;
  } else if (passPercentage >= 75 && cantSolveCount === 0) {
    summaryCore = `${studentName} demonstrated strong technical command and good conceptual depth across the evaluated topics.`;
  } else if (solvedCount + partialCount >= Math.ceil(totalEvaluated * 0.6)) {
    summaryCore = `${studentName} demonstrated satisfactory core concepts with moderate problem solving, but needs to strengthen partial areas.`;
  } else {
    summaryCore = `${studentName} struggled on several fundamental topics; recommended intensive practice before external technical rounds.`;
  }

  // 2. Specific question details
  const detailsParts: string[] = [];
  if (partialQuestions.length > 0) {
    detailsParts.push(`Needs improvement in: ${partialQuestions.slice(0, 4).join(', ')}`);
  }
  if (cantSolveQuestions.length > 0) {
    detailsParts.push(`Could not answer: ${cantSolveQuestions.slice(0, 4).join(', ')}`);
  }

  // 3. Soft Skills & Communication Note
  const softNotes: string[] = [];
  if (feedback.bengaliLevel || feedback.englishLevel) {
    const lang = [
      feedback.englishLevel ? `English: ${feedback.englishLevel}` : '',
      feedback.bengaliLevel ? `Bengali: ${feedback.bengaliLevel}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    softNotes.push(`Communication (${lang})`);
  }
  if (feedback.interpersonalLevel) {
    softNotes.push(`Interpersonal: ${feedback.interpersonalLevel}`);
  }

  // 4. Combine into final professional paragraph
  const paragraphs: string[] = [summaryCore];
  if (detailsParts.length > 0) {
    paragraphs.push(detailsParts.join('. ') + '.');
  }
  if (softNotes.length > 0) {
    paragraphs.push(`Soft skills observation: ${softNotes.join(' • ')}.`);
  }
  if (feedback.finalRecommendation) {
    paragraphs.push(`Final Verdict: ${feedback.finalRecommendation}.`);
  }

  return {
    finalComment: paragraphs.join('\n\n'),
    passPercentage,
    solvedCount,
    partialCount,
    cantSolveCount,
    totalEvaluated,
  };
}

/**
 * Format interview records into the 15 standardized Google Sheet columns
 */
export function formatInterviewTo15Columns(interview: Interview): NexViewExportRow {
  const { student, feedback } = interview;

  // Question lists
  const solved: string[] = [];
  const partial: string[] = [];
  const cantSolve: string[] = [];

  (feedback?.technicalEvaluation || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      const line = `${sec.label}: ${q.text}`;
      if (q.status === 'solved') solved.push(line);
      else if (q.status === 'partial') partial.push(line);
      else if (q.status === 'cant_solve') cantSolve.push(line);
    });
  });

  const formatList = (arr: string[]) =>
    arr.length > 0 ? arr.map((item, i) => `${i + 1}. ${item}`).join('\n') : 'None';

  // Language
  const langParts: string[] = [];
  if (feedback?.bengaliLevel) langParts.push(`Bengali: ${feedback.bengaliLevel}`);
  if (feedback?.englishLevel) langParts.push(`English: ${feedback.englishLevel}`);
  const languageProficiency = langParts.length > 0 ? langParts.join(' | ') : 'Not Evaluated';

  // Camera & Environment
  const cameraParts: string[] = [];
  cameraParts.push(feedback?.cameraOn ? 'Camera: ON' : 'Camera: OFF');
  if (feedback?.cameraOn) {
    if (feedback.eyeContact) cameraParts.push(`Eye Contact: ${feedback.eyeContact}`);
    if (feedback.backgroundLevel) cameraParts.push(`Background: ${feedback.backgroundLevel}`);
  }
  const cameraAndEnvironment = cameraParts.join(' | ');

  // Problem Solving
  const problemSolving = feedback?.problemSolvingLevel
    ? `${feedback.problemSolvingLevel.replace('_', ' ').toUpperCase()}${
        feedback.problemSolvingComment ? ` (${feedback.problemSolvingComment})` : ''
      }`
    : 'N/A';

  return {
    studentName: student.name,
    email: student.email,
    phone: student.phone || 'N/A',
    course: student.course,
    slotOrBatch: `${student.slot || ''} [${student.batch}]`.trim(),
    status: interview.status,
    interpersonalSkills: feedback?.interpersonalLevel || 'N/A',
    languageProficiency,
    cameraAndEnvironment,
    technicalSolved: formatList(solved),
    technicalPartiallySolved: formatList(partial),
    technicalCantSolve: formatList(cantSolve),
    problemSolving,
    finalRecommendation: feedback?.finalRecommendation || 'Pending Review',
    generalFeedback: feedback?.finalComment || 'No feedback submitted.',
  };
}

export const NEXVIEW_15_HEADERS = [
  'Student Name',
  'Email',
  'Phone',
  'Course',
  'Slot / Batch',
  'Status',
  'Interpersonal Skills',
  'Language Proficiency',
  'Camera & Environment',
  'Technical (Solved)',
  'Technical (Partially Solved)',
  'Technical (Can\'t Solve)',
  'Problem Solving',
  'Final Recommendation',
  'General Feedback / Final Comments',
];

/**
 * Generate TSV Clipboard string ready for pasting directly into Google Sheets (Ctrl+V)
 */
export function generateNexViewTsv(interviews: Interview[]): string {
  const headerLine = NEXVIEW_15_HEADERS.map(escapeTsvCell).join('\t');
  const rowLines = interviews.map((item) => {
    const row = formatInterviewTo15Columns(item);
    return [
      row.studentName,
      row.email,
      row.phone,
      row.course,
      row.slotOrBatch,
      row.status,
      row.interpersonalSkills,
      row.languageProficiency,
      row.cameraAndEnvironment,
      row.technicalSolved,
      row.technicalPartiallySolved,
      row.technicalCantSolve,
      row.problemSolving,
      row.finalRecommendation,
      row.generalFeedback,
    ]
      .map(escapeTsvCell)
      .join('\t');
  });

  return [headerLine, ...rowLines].join('\n');
}

/**
 * Generate CSV string for downloading .csv file
 */
export function generateNexViewCsv(interviews: Interview[]): string {
  const escapeCsvCell = (val: unknown): string => {
    const s = (val ?? '').toString();
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = NEXVIEW_15_HEADERS.map(escapeCsvCell).join(',');
  const rowLines = interviews.map((item) => {
    const row = formatInterviewTo15Columns(item);
    return [
      row.studentName,
      row.email,
      row.phone,
      row.course,
      row.slotOrBatch,
      row.status,
      row.interpersonalSkills,
      row.languageProficiency,
      row.cameraAndEnvironment,
      row.technicalSolved,
      row.technicalPartiallySolved,
      row.technicalCantSolve,
      row.problemSolving,
      row.finalRecommendation,
      row.generalFeedback,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headerLine, ...rowLines].join('\n');
}

/**
 * Parse Google Doc Text into Course Categories
 */
export function parseDocToCategories(docText: string): CourseTemplateCategory[] {
  const lines = docText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const categories: CourseTemplateCategory[] = [];
  let currentCategory: CourseTemplateCategory | null = null;

  lines.forEach((line) => {
    // Check if line looks like a category heading (e.g. "1. JavaScript", "HTML & CSS", "## React")
    const isHeading =
      /^(?:\d+[\.\)]|#+|[A-Z\s&/]{3,30}:?)/.test(line) &&
      !line.endsWith('?') &&
      line.length < 50;

    if (isHeading) {
      const cleanLabel = line.replace(/^(?:\d+[\.\)]|#+)\s*/, '').replace(/:$/, '').trim();
      currentCategory = {
        id: cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: cleanLabel,
        suggestions: [],
      };
      categories.push(currentCategory);
    } else if (currentCategory) {
      // Clean bullet or question text
      const cleanQ = line.replace(/^[•\-\*\d+\.]\s*/, '').trim();
      if (cleanQ.length > 5) {
        currentCategory.suggestions.push(cleanQ);
      }
    }
  });

  return categories;
}
