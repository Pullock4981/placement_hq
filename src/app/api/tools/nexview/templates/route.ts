import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_COURSE_TEMPLATES } from '@/tools/operations/nexview/default-templates';
import { parseDocToCategories } from '@/tools/operations/nexview/nexview-engine';
import { CourseTemplate } from '@/tools/operations/nexview/nexview-types';

export const runtime = 'nodejs';

let templatesCache: Record<string, CourseTemplate> = { ...DEFAULT_COURSE_TEMPLATES };

export async function GET() {
  return NextResponse.json({
    success: true,
    templates: templatesCache,
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.course || !body.categories) {
      return NextResponse.json(
        { success: false, message: 'Course name and categories are required.' },
        { status: 400 },
      );
    }

    templatesCache[body.course] = {
      course: body.course,
      showProblemSolving: body.showProblemSolving ?? true,
      categories: body.categories,
    };

    return NextResponse.json({
      success: true,
      message: `Template for ${body.course} saved successfully.`,
      template: templatesCache[body.course],
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to save template.' },
      { status: 500 },
    );
  }
}

// Import questions from Google Doc
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.docUrl) {
      return NextResponse.json(
        { success: false, message: 'Please provide a Google Doc URL.' },
        { status: 400 },
      );
    }

    const { docUrl, course = 'Custom Track' } = body;
    const match = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/i);

    if (!match || !match[1]) {
      return NextResponse.json(
        { success: false, message: 'Invalid Google Doc URL. Document ID not found.' },
        { status: 400 },
      );
    }

    const docId = match[1];
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const res = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            'No text extracted from Google Doc. Please ensure "Anyone with the link can view" is set in document Share settings.',
        },
        { status: 400 },
      );
    }

    const docText = await res.text();
    const categories = parseDocToCategories(docText);

    if (categories.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No categories or questions detected in Google Doc.',
        },
        { status: 400 },
      );
    }

    const updatedTemplate: CourseTemplate = {
      course,
      showProblemSolving: true,
      categories,
    };

    templatesCache[course] = updatedTemplate;

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${categories.length} categories and questions from Google Doc!`,
      template: updatedTemplate,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to parse Google Doc.' },
      { status: 500 },
    );
  }
}
