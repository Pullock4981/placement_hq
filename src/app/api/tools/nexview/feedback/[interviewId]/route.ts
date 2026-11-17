import { NextRequest, NextResponse } from 'next/server';
import {
  getCachedNexViewData,
  updateCachedNexViewData,
} from '@/tools/operations/nexview/nexview-store';
import { computeAutoFeedback } from '@/tools/operations/nexview/nexview-engine';
import { Feedback } from '@/tools/operations/nexview/nexview-types';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { interviewId: string } },
) {
  const { interviewId } = params;
  const { interviews } = getCachedNexViewData();
  const interview = interviews.find((i) => i.id === interviewId);

  if (!interview) {
    return NextResponse.json(
      { success: false, message: 'Interview record not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    interview,
    feedback: interview.feedback || null,
  });
}

// Save Draft (PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { interviewId: string } },
) {
  try {
    const { interviewId } = params;
    const body = await request.json().catch(() => null);

    if (!body || !body.feedback) {
      return NextResponse.json(
        { success: false, message: 'Feedback data is required.' },
        { status: 400 },
      );
    }

    const { students, interviews } = getCachedNexViewData();
    const interview = interviews.find((i) => i.id === interviewId);

    if (!interview) {
      return NextResponse.json(
        { success: false, message: 'Interview record not found.' },
        { status: 404 },
      );
    }

    const updatedFeedback: Feedback = {
      ...(interview.feedback || {}),
      ...body.feedback,
      cameraOn: body.feedback.cameraOn ?? interview.feedback?.cameraOn ?? true,
      technicalEvaluation: body.feedback.technicalEvaluation ?? interview.feedback?.technicalEvaluation ?? [],
      id: interview.feedback?.id || `FB-${interviewId}`,
      interviewId,
      status: 'draft',
    };

    interview.feedback = updatedFeedback;
    interview.status = 'Draft Saved';

    updateCachedNexViewData(students, interviews);

    return NextResponse.json({
      success: true,
      message: 'Draft saved successfully (Status: Draft Saved).',
      interview,
      feedback: updatedFeedback,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to save draft.' },
      { status: 500 },
    );
  }
}

// Submit Final (POST)
export async function POST(
  request: NextRequest,
  { params }: { params: { interviewId: string } },
) {
  try {
    const { interviewId } = params;
    const body = await request.json().catch(() => null);

    if (!body || !body.feedback) {
      return NextResponse.json(
        { success: false, message: 'Feedback data is required.' },
        { status: 400 },
      );
    }

    const { students, interviews } = getCachedNexViewData();
    const interview = interviews.find((i) => i.id === interviewId);

    if (!interview) {
      return NextResponse.json(
        { success: false, message: 'Interview record not found.' },
        { status: 404 },
      );
    }

    const incomingFeedback = body.feedback as Partial<Feedback>;

    // Strict Validations per master specification:
    // 1. Final Recommendation required
    if (!incomingFeedback.finalRecommendation) {
      return NextResponse.json(
        { success: false, message: 'Please select a Final Recommendation.' },
        { status: 400 },
      );
    }

    // 2. Interpersonal level required
    if (!incomingFeedback.interpersonalLevel) {
      return NextResponse.json(
        { success: false, message: 'Interpersonal skills rating is required.' },
        { status: 400 },
      );
    }

    // 3. Language level required (Bengali or English)
    if (!incomingFeedback.bengaliLevel && !incomingFeedback.englishLevel) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please provide at least one Language Proficiency rating (Bengali or English).',
        },
        { status: 400 },
      );
    }

    // 4. Camera fields conditional validation
    if (incomingFeedback.cameraOn) {
      if (!incomingFeedback.eyeContact || !incomingFeedback.backgroundLevel) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Eye Contact and Background ratings are required when camera is active.'
          },
          { status: 400 },
        );
      }
    } else {
      // Camera off sanitization: sub-fields set to undefined/null
      incomingFeedback.eyeContact = undefined;
      incomingFeedback.backgroundLevel = undefined;
    }

    // Auto compute comments if not manually typed
    let finalComment = incomingFeedback.finalComment?.trim();
    if (!finalComment) {
      const autoGen = computeAutoFeedback(incomingFeedback, interview.student.name);
      finalComment = autoGen.finalComment;
    }

    const finalFeedback: Feedback = {
      ...(interview.feedback || {}),
      ...incomingFeedback,
      cameraOn: incomingFeedback.cameraOn ?? interview.feedback?.cameraOn ?? true,
      technicalEvaluation: incomingFeedback.technicalEvaluation ?? interview.feedback?.technicalEvaluation ?? [],
      id: interview.feedback?.id || `FB-${interviewId}`,
      interviewId,
      status: 'final',
      finalComment,
      submittedAt: new Date().toISOString(),
    };

    interview.feedback = finalFeedback;
    interview.status = 'Completed';
    interview.completedAt = new Date().toISOString();

    updateCachedNexViewData(students, interviews);

    return NextResponse.json({
      success: true,
      message: 'Interview completed successfully (Status: Completed).',
      interview,
      feedback: finalFeedback,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to submit interview feedback.' },
      { status: 500 },
    );
  }
}
