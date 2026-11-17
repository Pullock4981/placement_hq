import { NextRequest, NextResponse } from 'next/server';
import { getToolsUsageSummary, trackToolUsage } from '@/lib/tools-usage/store';
import { getUserFromHeaders } from '@/lib/auth/helpers';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const summary = getToolsUsageSummary();
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to retrieve tools usage summary.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.toolId || !body.toolName) {
      return NextResponse.json(
        { success: false, message: 'toolId and toolName are required.' },
        { status: 400 },
      );
    }

    const headerUser = getUserFromHeaders(request.headers);
    const referer = request.headers.get('referer') || '';
    let defaultRole: 'admin' | 'manager' | 'mentor' = 'mentor';
    if (referer.includes('/admin')) defaultRole = 'admin';
    else if (referer.includes('/manager')) defaultRole = 'manager';

    const userName = body.userName || headerUser?.name || 'Placement Evaluator';
    const userEmail = body.userEmail || headerUser?.email || `${defaultRole}@programming-hero.com`;
    const userRole = body.userRole || headerUser?.role || defaultRole;

    const record = trackToolUsage({
      toolId: body.toolId,
      toolName: body.toolName,
      userName,
      userEmail,
      userRole,
      actionType: body.actionType || 'single_audit',
      candidateCount: body.candidateCount || 1,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to record tool usage.' },
      { status: 500 },
    );
  }
}
