import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGithubData,
  evaluateGithubProfile,
  extractGithubUsername,
} from '@/tools/operations/github-check/github-evaluator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.username) {
      return NextResponse.json(
        { success: false, message: 'Please provide a GitHub username or URL.' },
        { status: 400 },
      );
    }

    const cleanUsername = extractGithubUsername(body.username);
    if (!cleanUsername) {
      return NextResponse.json(
        { success: false, message: 'Valid GitHub username not found.' },
        { status: 400 },
      );
    }

    const data = await fetchGithubData(cleanUsername);
    const result = evaluateGithubProfile(data);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json(
      {
        success: false,
        message: e.message || 'Failed to audit GitHub profile.',
      },
      { status: 500 },
    );
  }
}

