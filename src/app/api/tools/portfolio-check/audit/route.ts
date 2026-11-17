import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPortfolioContent,
  evaluatePortfolio,
  validatePortfolioUrl,
} from '@/tools/operations/portfolio-check/portfolio-evaluator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || (!body.url && !body.pastedHtml)) {
      return NextResponse.json(
        { success: false, message: 'Please provide a portfolio URL or page source HTML.' },
        { status: 400 },
      );
    }

    const { url = '', pastedHtml = '' } = body;

    // Check Auth Wall or Dashboard
    if (url) {
      const urlCheck = validatePortfolioUrl(url);
      if (!urlCheck.isValid) {
        const blockedResult = evaluatePortfolio(url, '', '', false, 'error');
        return NextResponse.json({
          success: true,
          result: blockedResult,
        });
      }
    }

    const fetched = await fetchPortfolioContent(url, pastedHtml);
    const result = evaluatePortfolio(
      url || 'Pasted-HTML-Source',
      fetched.html,
      fetched.projectDetailHtml,
      fetched.isCloudflareBlocked,
      fetched.fetchedVia,
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json(
      {
        success: false,
        message: e.message || 'Failed to audit portfolio.',
      },
      { status: 500 },
    );
  }
}

