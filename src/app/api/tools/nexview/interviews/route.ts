import { NextRequest, NextResponse } from 'next/server';
import {
  getCachedNexViewData,
  updateCachedNexViewData,
} from '@/tools/operations/nexview/nexview-store';
import { Feedback, Interview } from '@/tools/operations/nexview/nexview-types';
import { DEFAULT_COURSE_TEMPLATES } from '@/tools/operations/nexview/default-templates';

export const runtime = 'nodejs';

export async function GET() {
  const { interviews } = getCachedNexViewData();
  return NextResponse.json({
    success: true,
    total: interviews.length,
    interviews,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.studentId) {
      return NextResponse.json(
        { success: false, message: 'Student ID is required.' },
        { status: 400 },
      );
    }

    const { studentId } = body;
    const { students, interviews } = getCachedNexViewData();

    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return NextResponse.json(
        { success: false, message: 'Candidate not found.' },
        { status: 404 },
      );
    }

    let interview = interviews.find((i) => i.studentId === studentId);
    if (!interview) {
      interview = {
        id: `INT-${studentId}`,
        studentId,
        student,
        course: student.course,
        batch: student.batch,
        status: 'Interview Started',
        startedAt: new Date().toISOString(),
      };
      interviews.unshift(interview);
    } else {
      interview.status = 'Interview Started';
      interview.startedAt = interview.startedAt || new Date().toISOString();
    }

    // Initialize default draft feedback if empty
    if (!interview.feedback) {
      const template =
        DEFAULT_COURSE_TEMPLATES[student.course] ||
        DEFAULT_COURSE_TEMPLATES['Full Stack Development'];

      const initialSections = (template?.categories || []).map((cat) => ({
        id: cat.id,
        label: cat.label,
        questions: (cat.suggestions || []).slice(0, 3).map((sugg, sIdx) => ({
          id: `Q-${cat.id}-${sIdx + 1}`,
          text: sugg,
          status: 'unanswered' as const,
        })),
      }));

      const draftFeedback: Feedback = {
        id: `FB-${interview.id}`,
        interviewId: interview.id,
        status: 'draft',
        cameraOn: true,
        experienceLevel: 'Fresher',
        technicalEvaluation: initialSections,
      };

      interview.feedback = draftFeedback;
    }

    updateCachedNexViewData(students, interviews);

    return NextResponse.json({
      success: true,
      message: 'Interview session started (Status: Interview Started).',
      interview,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to start interview.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const course = searchParams.get('course');

    const { students, interviews } = getCachedNexViewData();

    if (id) {
      const filtered = interviews.filter((i) => i.id !== id);
      updateCachedNexViewData(students, filtered);
      return NextResponse.json({ success: true, message: 'Interview session deleted.' });
    }

    if (course) {
      const filtered = interviews.filter((i) => i.course !== course);
      updateCachedNexViewData(students, filtered);
      return NextResponse.json({
        success: true,
        message: `All interviews for ${course} have been deleted.`,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Specify a valid ID or course.' },
      { status: 400 },
    );
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to delete record.' },
      { status: 500 },
    );
  }
}
