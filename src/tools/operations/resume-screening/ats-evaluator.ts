/**
 * ATS Resume Structure & Format Evaluator
 * Seamlessly powered by the 100 Marks Master Rubric
 */

import { AtsRubricScore } from './types';
import { evaluateAtsMasterRubric } from '../ats-resume/ats-master-rubric';

export function evaluateAtsStructure(resumeText: string): AtsRubricScore {
  if (!resumeText || resumeText.trim().length === 0) {
    return {
      score: 0,
      structureScore: 0,
      contactInfoPresent: false,
      experiencePresent: false,
      projectsPresent: false,
      skillsPresent: false,
      bulletPointsCount: 0,
      wordCount: 0,
      feedback: ['No resume found or file is empty (No Resume Submitted)'],
    };
  }

  const rubric = evaluateAtsMasterRubric(resumeText);

  return {
    score: rubric.totalScore,
    structureScore: rubric.categories.parsingStructure.score + rubric.categories.sectionOrganization.score,
    contactInfoPresent: rubric.metrics.hasEmail && (rubric.metrics.hasPhone || rubric.metrics.hasLinkedIn),
    experiencePresent: rubric.metrics.detectedSections.includes('Experience'),
    projectsPresent: rubric.metrics.detectedSections.includes('Projects / Summary'),
    skillsPresent: rubric.metrics.detectedSections.includes('Skills'),
    bulletPointsCount: rubric.metrics.actionVerbsFound.length + rubric.metrics.quantifiableMetricsFound.length,
    wordCount: rubric.metrics.wordCount,
    feedback: rubric.recommendations,
  };
}
