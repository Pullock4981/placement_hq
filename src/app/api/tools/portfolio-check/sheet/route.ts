import { NextRequest, NextResponse } from 'next/server';
import {
  extractGoogleSheetId,
  extractGoogleSheetGid,
  parseCsvToRows,
  SheetCandidateRow,
  getColumnLetter,
} from '@/tools/operations/resume-screening/sheet-processor';
import {
  fetchPortfolioContent,
  evaluatePortfolio,
  PortfolioEvaluationResult,
} from '@/tools/operations/portfolio-check/portfolio-evaluator';
import { getSheetsClient } from '@/lib/sheets/client';
import { GOOGLE_OAUTH_SESSION_COOKIE, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { createAuthorizedGoogleClients } from '@/lib/google-oauth/client';
import type { sheets_v4 } from 'googleapis';

export const runtime = 'nodejs';

// Safe Range Helper
function formatSafeRange(sheetTitle: string, a1Range: string): string {
  const cleanTitle = (sheetTitle || 'Sheet1').trim();
  const escapedTitle = cleanTitle.replace(/'/g, "''");
  return `'${escapedTitle}'!${a1Range}`;
}

// Controlled concurrency helper
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface PortfolioCandidateRow extends Omit<SheetCandidateRow, 'syncStatus'> {
  portfolioUrl?: string;
  portfolioResult?: PortfolioEvaluationResult;
  portfolioScore?: number;
  portfolioScorePercentage?: number;
  portfolioGrade?: string;
  portfolioFeedback?: string;
  syncStatus?: 'pending' | 'screened' | 'audited' | 'synced' | 'failed';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.sheetUrl) {
      return NextResponse.json(
        { message: 'Google Sheet URL is required.' },
        { status: 400 },
      );
    }

    const {
      sheetUrl,
      action = 'audit', // 'fetch' | 'audit'
      pastedSheetData,
      candidates: incomingCandidates,
    } = body;

    const spreadsheetId = extractGoogleSheetId(sheetUrl);
    if (!spreadsheetId && !pastedSheetData) {
      return NextResponse.json(
        { message: 'Invalid Google Sheet URL. Spreadsheet ID not found.' },
        { status: 400 },
      );
    }

    let rows: Record<string, string>[] = [];
    let fetchMethod = 'public-csv';
    let lastStatusCode = 200;

    // 0. If pastedSheetData provided
    if (pastedSheetData && typeof pastedSheetData === 'string' && pastedSheetData.trim().length > 0) {
      rows = parseCsvToRows(pastedSheetData);
      fetchMethod = 'pasted-data';
    }

    // 1. Fetch from sheet if not pasted
    if (rows.length === 0 && spreadsheetId) {
      try {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
        const res = await fetch(exportUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'text/csv,text/plain,*/*',
          },
          cache: 'no-store',
          redirect: 'follow',
        });
        lastStatusCode = res.status;
        if (res.ok) {
          const csvData = await res.text();
          if (csvData && !csvData.trim().startsWith('<!DOCTYPE html>')) {
            rows = parseCsvToRows(csvData);
          }
        }
      } catch {
        // Fallback
      }

      if (rows.length === 0) {
        try {
          const directExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
          const res2 = await fetch(directExportUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'text/csv,text/plain,*/*',
            },
            cache: 'no-store',
            redirect: 'follow',
          });
          if (res2.ok) {
            const csvData2 = await res2.text();
            if (csvData2 && !csvData2.trim().startsWith('<!DOCTYPE html>')) {
              rows = parseCsvToRows(csvData2);
            }
          }
        } catch {
          // Fallback
        }
      }

      // Try Google Sheets API client
      if (rows.length === 0) {
        try {
          const oauthCookie = request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value;
          const userOAuthSession = openGoogleOAuthSession(oauthCookie);
          let client: sheets_v4.Sheets;

          if (userOAuthSession?.refreshToken) {
            try {
              client = createAuthorizedGoogleClients(userOAuthSession).sheets;
            } catch {
              client = await getSheetsClient();
            }
          } else {
            client = await getSheetsClient();
          }

          const sheetMeta = (await client.spreadsheets.get({ spreadsheetId } as any)) as any;
          const firstSheetName = sheetMeta.data?.sheets?.[0]?.properties?.title || 'Sheet1';
          const valuesRes = (await client.spreadsheets.values.get({
            spreadsheetId,
            range: `${firstSheetName}!A1:Z100`,
          } as any)) as any;

          const sheetValues = valuesRes.data?.values || [];
          if (sheetValues.length > 1) {
            const headers = sheetValues[0].map((h: string) => String(h || '').trim());
            for (let i = 1; i < sheetValues.length; i++) {
              const rowArr = sheetValues[i];
              const rowObj: Record<string, string> = {};
              headers.forEach((h: string, hIdx: number) => {
                rowObj[h] = String(rowArr[hIdx] || '').trim();
              });
              rows.push(rowObj);
            }
            fetchMethod = 'google-api';
          }
        } catch (clientErr: unknown) {
          const e = clientErr as Error;
          if (e.message?.includes('permission') || e.message?.includes('401') || e.message?.includes('403')) {
            lastStatusCode = 401;
          }
        }
      }
    }

    if (rows.length === 0 && (!incomingCandidates || incomingCandidates.length === 0)) {
      if (lastStatusCode === 401 || lastStatusCode === 403) {
        return NextResponse.json(
          {
            success: false,
            errorType: 'PERMISSION_DENIED',
            statusCode: 401,
            spreadsheetId,
            message:
              'Google did not permit access to this sheet (HTTP 401: Unauthorized). Please select "Anyone with the link can edit" or Connect Google.',
          },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          errorType: 'EMPTY_OR_UNREADABLE',
          spreadsheetId,
          message:
            'No candidate data loaded from Google Sheet. Ensure headers (Name, Portfolio Link) are present.',
        },
        { status: 400 },
      );
    }

    // Map rows to candidate list
    let candidates: PortfolioCandidateRow[] = [];
    if (incomingCandidates && incomingCandidates.length > 0) {
      candidates = incomingCandidates;
    } else if (rows.length > 0) {
      const validRows = rows.filter((r) => {
        const values = Object.values(r).map((v) => String(v || '').trim());
        return values.some((v) => v.length > 0);
      });

      candidates = validRows.map((r, idx) => {
        const keys = Object.keys(r);
        const findKey = (patterns: RegExp[]): string | undefined => {
          return keys.find((k) => patterns.some((p) => p.test(k.toLowerCase())));
        };

        const nameKey =
          findKey([/^name$/i, /candidate\s*name/i, /student\s*name/i, /applicant\s*name/i, /full\s*name/i, /নাম/i, /name/i]) ||
          (keys[0]?.toLowerCase().includes('time') ? keys[1] : keys[0]) ||
          'Name';
        const batchKey = findKey([/batch/i, /cohort/i, /course/i, /track/i, /ব্যাচ/i]);

        let portfolioKey = findKey([
          /পোর্টফোলিও/i,
          /portfolio/i,
          /live\s*link/i,
          /live\s*site/i,
          /live\s*url/i,
          /website/i,
          /web\s*site/i,
          /site\s*link/i,
          /web\s*link/i,
          /লাইভ/i,
          /লিংক/i,
          /url/i,
        ]);

        if (!portfolioKey) {
          // Look for any link containing vercel, netlify, github.io, etc. but not drive/docs
          const detectedUrlKey = keys.find((k) => {
            const val = String(r[k] || '');
            return (
              (val.includes('.vercel.app') ||
                val.includes('.netlify.app') ||
                val.includes('.github.io') ||
                val.includes('.surge.sh') ||
                val.includes('.render.com') ||
                val.includes('.web.app') ||
                val.includes('.firebaseapp.com')) &&
              !val.includes('drive.google.com') &&
              !val.includes('docs.google.com')
            );
          });
          if (detectedUrlKey) portfolioKey = detectedUrlKey;
        }

        const candidateName = r[nameKey]?.trim() || `Candidate ${idx + 1}`;
        const batchName = (batchKey && r[batchKey]?.trim()) || 'Web Development';
        let portfolioUrl = (portfolioKey && r[portfolioKey]?.trim()) || '';

        // If not found or empty, scan ALL fields in this row for any live web URL
        if (!portfolioUrl || !portfolioUrl.startsWith('http')) {
          for (const k of keys) {
            const val = String(r[k] || '').trim();
            if (
              val.startsWith('http') &&
              !val.includes('drive.google.com') &&
              !val.includes('docs.google.com') &&
              !val.includes('mail.google.com')
            ) {
              portfolioUrl = val;
              break;
            }
          }
        }

        // Check if candidate wrote a URL without protocol (e.g. my-project.vercel.app)
        if (!portfolioUrl) {
          for (const k of keys) {
            const val = String(r[k] || '').trim();
            if (
              val.includes('.vercel.app') ||
              val.includes('.netlify.app') ||
              val.includes('.github.io') ||
              val.includes('.surge.sh') ||
              val.includes('.render.com') ||
              val.includes('.web.app') ||
              val.includes('.firebaseapp.com')
            ) {
              portfolioUrl = val.startsWith('http') ? val : `https://${val}`;
              break;
            }
          }
        }

        return {
          rowNumber: idx + 2,
          name: candidateName,
          batch: batchName,
          resumeLink: portfolioUrl,
          portfolioUrl,
          syncStatus: 'pending',
        };
      });
    }

    // Action === 'fetch': Return loaded candidates
    if (action === 'fetch') {
      return NextResponse.json({
        success: true,
        spreadsheetId,
        fetchMethod,
        total: candidates.length,
        candidates,
      });
    }

    // Action === 'audit': Run Portfolio 60 Marks Evaluation for each candidate
    const auditedCandidates: PortfolioCandidateRow[] = await mapConcurrent(
      candidates,
      5,
      async (cand) => {
        const targetUrl = (cand.portfolioUrl || cand.resumeLink || '').trim();

        if (!targetUrl || targetUrl.length < 5) {
          return {
            ...cand,
            portfolioScore: 0,
            portfolioScorePercentage: 0,
            portfolioGrade: 'Needs Improvement',
            portfolioFeedback: 'No portfolio link provided.',
            syncStatus: 'failed',
          };
        }

        try {
          const fetched = await fetchPortfolioContent(targetUrl);
          const evaluation = evaluatePortfolio(
            targetUrl,
            fetched.html,
            fetched.projectDetailHtml,
            fetched.isCloudflareBlocked,
            fetched.fetchedVia,
          );

          return {
            ...cand,
            portfolioUrl: targetUrl,
            portfolioResult: evaluation,
            portfolioScore: evaluation.totalScore,
            portfolioScorePercentage: evaluation.percentage,
            portfolioGrade: evaluation.grade,
            portfolioFeedback: evaluation.recommendations.join(' • '),
            syncStatus: 'audited',
          };
        } catch (err: unknown) {
          const e = err as Error;
          return {
            ...cand,
            portfolioScore: 0,
            portfolioScorePercentage: 0,
            portfolioGrade: 'Needs Improvement',
            portfolioFeedback: `Audit error: ${e.message || 'Could not load portfolio'}`,
            syncStatus: 'failed',
        };
      }
    },
  );

  // AUTOMATIC GOOGLE SHEET UPDATE
  let syncedToSheet = false;
  let syncError: string | null = null;

    if (spreadsheetId) {
      try {
        const oauthCookie = request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value;
        const userOAuthSession = openGoogleOAuthSession(oauthCookie);
        let client: sheets_v4.Sheets;

        if (userOAuthSession?.refreshToken) {
          try {
            client = createAuthorizedGoogleClients(userOAuthSession).sheets;
          } catch (authErr) {
            console.warn('OAuth client init failed, falling back to gateway:', authErr);
            client = await getSheetsClient();
          }
        } else {
          client = await getSheetsClient();
        }

        let sheets: any[] = [];
        try {
          const sheetMeta = (await client.spreadsheets.get({ spreadsheetId } as any)) as any;
          sheets = sheetMeta.data?.sheets || [];
        } catch (metaErr) {
          console.warn('Could not read sheet metadata via client:', metaErr);
        }

        const targetGid = extractGoogleSheetGid(sheetUrl);
        let targetSheet = sheets[0];
        if (targetGid !== null && sheets.length > 0) {
          const matched = sheets.find((s: any) => s?.properties?.sheetId === targetGid);
          if (matched) targetSheet = matched;
        }

        const firstSheetName = targetSheet?.properties?.title;
        const targetSheetId = targetSheet?.properties?.sheetId ?? 0;

        const buildRange = (a1: string) => {
          return firstSheetName ? formatSafeRange(firstSheetName, a1) : a1;
        };

        // Try reading row 1 headers
        let headerRow: string[] = [];
        try {
          const headerRes = (await client.spreadsheets.values.get({
            spreadsheetId,
            range: buildRange('1:1'),
          } as any)) as any;
          headerRow = (headerRes.data?.values?.[0] || []).map((h: string) =>
            String(h || '').trim(),
          );
        } catch (headerErr) {
          console.warn('Could not read row 1 headers:', headerErr);
        }

        let scoreColIdx = headerRow.findIndex((h: string) => /portfolio.*score/i.test(h));
        const detectedColCount = rows.length > 0 ? Object.keys(rows[0]).length : 10;
        const fallbackColIdx = Math.max(headerRow.length, detectedColCount, 10);
        const startColIdx = scoreColIdx !== -1 ? scoreColIdx : fallbackColIdx;

        // Structured Columns for Portfolio 60 Marks Evaluation
        const structuredHeaders = [
          'Portfolio Score (60)',
          'Portfolio Grade',
          'Nav & Hero (9)',
          'Resume & Socials (8)',
          'About & Skills (12)',
          'Edu & Experience (6)',
          'Projects & Details (15)',
          'Contact & Responsive (10)',
          'Portfolio Actionable Recommendations',
        ];

        const endColIdx = startColIdx + structuredHeaders.length - 1;
        const startColLetter = getColumnLetter(startColIdx);
        const endColLetter = getColumnLetter(endColIdx);

        // Auto-expand sheet grid columns if needed so it never exceeds grid limits
        const currentGridColCount = targetSheet?.properties?.gridProperties?.columnCount || 10;
        const requiredGridColCount = endColIdx + 1;
        if (requiredGridColCount > currentGridColCount) {
          try {
            await client.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    appendDimension: {
                      sheetId: targetSheetId,
                      dimension: 'COLUMNS',
                      length: requiredGridColCount - currentGridColCount + 2,
                    },
                  },
                ],
              },
            } as any);
          } catch (dimErr) {
            console.warn('Could not append columns via appendDimension, trying updateSheetProperties:', dimErr);
            try {
              await client.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                  requests: [
                    {
                      updateSheetProperties: {
                        properties: {
                          sheetId: targetSheetId,
                          gridProperties: {
                            columnCount: requiredGridColCount + 2,
                          },
                        },
                        fields: 'gridProperties.columnCount',
                      },
                    },
                  ],
                },
              } as any);
            } catch (propErr) {
              console.warn('Could not update columnCount:', propErr);
            }
          }
        }

        // 1. Write Row 1 Headers
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: buildRange(`${startColLetter}1:${endColLetter}1`),
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [structuredHeaders] },
        } as any);

        // 2. Prepare Contiguous Matrix for Candidate Rows
        const minRowNumber = Math.min(...auditedCandidates.map((c) => c.rowNumber));
        const maxRowNumber = Math.max(...auditedCandidates.map((c) => c.rowNumber));
        const rowCount = maxRowNumber - minRowNumber + 1;

        const matrix: string[][] = Array.from({ length: rowCount }, () =>
          Array(structuredHeaders.length).fill(''),
        );

        auditedCandidates.forEach((cand) => {
          const rowOffset = cand.rowNumber - minRowNumber;
          if (rowOffset >= 0 && rowOffset < rowCount && cand.portfolioResult) {
            const r = cand.portfolioResult;
            const c = r.criteria;

            const navHeroScore = (c['nav_bar']?.score || 0) + (c['hero_designation']?.score || 0);
            const resumeSocialsScore = (c['resume_button']?.score || 0) + (c['social_media']?.score || 0);
            const aboutSkillsScore = (c['about_me']?.score || 0) + (c['skills_section']?.score || 0);
            const eduExpScore = (c['education_section']?.score || 0) + (c['experience_bonus']?.score || 0);
            const projectsScore = (c['project_cards']?.score || 0) + (c['project_detail_breakdown']?.score || 0);
            const contactRespScore = (c['contact_section']?.score || 0) + (c['responsive_design']?.score || 0);

            matrix[rowOffset] = [
              `${r.totalScore}/60 (${r.percentage}%)`,
              r.grade,
              `${navHeroScore}/9`,
              `${resumeSocialsScore}/8`,
              `${aboutSkillsScore}/12`,
              `${eduExpScore}/6`,
              `${projectsScore}/15`,
              `${contactRespScore}/10`,
              r.recommendations.join(' • '),
            ];
          } else if (rowOffset >= 0 && rowOffset < rowCount) {
            matrix[rowOffset] = [
              '0/60 (0%)',
              'Needs Improvement',
              '0/9',
              '0/8',
              '0/12',
              '0/6',
              '0/15',
              '0/10',
              cand.portfolioFeedback || 'No Portfolio link provided',
            ];
          }
        });

        // Write contiguous matrix in ONE atomic update call
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: buildRange(`${startColLetter}${minRowNumber}:${endColLetter}${maxRowNumber}`),
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: matrix },
        } as any);

        syncedToSheet = true;
        auditedCandidates.forEach((c) => {
          c.syncStatus = 'synced';
        });

        // 3. Automatically sort Google Sheet: highest Portfolio score descending
        try {
          await client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  sortRange: {
                    range: {
                      sheetId: targetSheetId,
                      startRowIndex: 1, // Skip header row
                      endRowIndex: maxRowNumber,
                      startColumnIndex: 0,
                      endColumnIndex: Math.max(headerRow.length, endColIdx + 1),
                    },
                    sortSpecs: [
                      {
                        dimensionIndex: startColIdx, // Sort descending by Portfolio Score
                        sortOrder: 'DESCENDING',
                      },
                    ],
                  },
                },
              ],
            },
          } as any);
        } catch (sortErr) {
          console.warn('Auto sort batch update failed (non-fatal):', sortErr);
        }
      } catch (writeErr: unknown) {
        const e = writeErr as Error;
        console.error('Failed to sync Portfolio audit results to Google Sheet:', e);
        syncError = e.message || 'Failed to update results in Google Sheet.';
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheetId,
      syncedToSheet,
      syncError,
      total: auditedCandidates.length,
      candidates: auditedCandidates,
    });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to process Google Sheet.' },
      { status: 500 },
    );
  }
}

