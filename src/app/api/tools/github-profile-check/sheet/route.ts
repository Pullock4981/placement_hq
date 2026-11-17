import { NextRequest, NextResponse } from 'next/server';
import {
  extractGoogleSheetId,
  extractGoogleSheetGid,
  parseCsvToRows,
  SheetCandidateRow,
  getColumnLetter,
} from '@/tools/operations/resume-screening/sheet-processor';
import {
  fetchGithubData,
  evaluateGithubProfile,
  extractGithubUsername,
  GithubEvaluationResult,
} from '@/tools/operations/github-check/github-evaluator';
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

export interface GithubCandidateRow extends Omit<SheetCandidateRow, 'syncStatus'> {
  githubUsername?: string;
  githubUrl?: string;
  githubResult?: GithubEvaluationResult;
  githubScore?: number;
  githubScorePercentage?: number;
  githubGrade?: string;
  githubFeedback?: string;
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
          // Fallback to client
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
            'No candidate data loaded from Google Sheet. Ensure headers (Name, GitHub Link/Username) are present.',
        },
        { status: 400 },
      );
    }

    // Map rows to candidate list
    let candidates: GithubCandidateRow[] = [];
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

        let githubKey = findKey([
          /github/i,
          /git\s*hub/i,
          /github\s*username/i,
          /github\s*link/i,
          /github\s*profile/i,
          /github\s*url/i,
          /profile\s*link/i,
          /গিটহাব/i,
        ]);

        if (!githubKey) {
          const detectedGithubKey = keys.find((k) => {
            const val = String(r[k] || '');
            return val.includes('github.com');
          });
          if (detectedGithubKey) githubKey = detectedGithubKey;
        }

        const candidateName = r[nameKey]?.trim() || `Candidate ${idx + 1}`;
        const batchName = (batchKey && r[batchKey]?.trim()) || 'Web Development';
        const rawGithub = (githubKey && r[githubKey]?.trim()) || '';
        const username = extractGithubUsername(rawGithub);

        return {
          rowNumber: idx + 2,
          name: candidateName,
          batch: batchName,
          resumeLink: rawGithub, // store raw link
          githubUsername: username,
          githubUrl: username ? `https://github.com/${username}` : rawGithub,
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

    // Action === 'audit': Run GitHub 60 Marks Deterministic Evaluator for each candidate
    const auditedCandidates: GithubCandidateRow[] = await Promise.all(
      candidates.map(async (cand) => {
        const cleanUser = cand.githubUsername || extractGithubUsername(cand.githubUrl || cand.resumeLink || '');

        if (!cleanUser) {
          return {
            ...cand,
            githubScore: 0,
            githubScorePercentage: 0,
            githubGrade: 'Needs Improvement',
            githubFeedback: 'No valid GitHub profile link or username found.',
            syncStatus: 'failed',
          };
        }

        try {
          const data = await fetchGithubData(cleanUser);
          const evaluation = evaluateGithubProfile(data);

          return {
            ...cand,
            githubUsername: cleanUser,
            githubUrl: `https://github.com/${cleanUser}`,
            githubResult: evaluation,
            githubScore: evaluation.totalScore,
            githubScorePercentage: evaluation.percentage,
            githubGrade: evaluation.grade,
            githubFeedback: evaluation.recommendations.join(' • '),
            syncStatus: 'audited',
          };
        } catch (err: unknown) {
          const e = err as Error;
          return {
            ...cand,
            githubScore: 0,
            githubScorePercentage: 0,
            githubGrade: 'Needs Improvement',
            githubFeedback: `Audit error: ${e.message || 'Could not fetch GitHub data'}`,
            syncStatus: 'failed',
          };
        }
      }),
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

        let scoreColIdx = headerRow.findIndex((h: string) => /github.*score/i.test(h));
        const detectedColCount = rows.length > 0 ? Object.keys(rows[0]).length : 10;
        const fallbackColIdx = Math.max(headerRow.length, detectedColCount, 10);
        const startColIdx = scoreColIdx !== -1 ? scoreColIdx : fallbackColIdx;

        // Structured Columns for GitHub 60 Marks Evaluation
        const structuredHeaders = [
          'GitHub Score (60)',
          'GitHub Grade',
          'Profile Identity (12)',
          'Designation & Intro (10)',
          'Skills & Badges (8)',
          'Links & Stats (6)',
          'Repositories (12)',
          'Demo & Quality (12)',
          'GitHub Actionable Recommendations',
        ];

        const endColIdx = startColIdx + structuredHeaders.length - 1;
        const startColLetter = getColumnLetter(startColIdx);
        const endColLetter = getColumnLetter(endColIdx);

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
          if (rowOffset >= 0 && rowOffset < rowCount && cand.githubResult) {
            const r = cand.githubResult;
            const c = r.criteria;

            // Group scores for clean sheet readability
            const profileIdentityScore = (c['profile_image']?.score || 0) + (c['location']?.score || 0) + (c['contact_info']?.score || 0) + (c['readme_banner']?.score || 0);
            const designationIntroScore = (c['name_and_designation']?.score || 0) + (c['about_me']?.score || 0) + (c['current_focus']?.score || 0);
            const skillsScore = c['skills_with_icons']?.score || 0;
            const linksStatsScore = (c['social_links']?.score || 0) + (c['stats_contributions']?.score || 0);
            const reposScore = (c['pinned_repos']?.score || 0) + (c['repo_description']?.score || 0);
            const demoQualityScore = (c['live_demo']?.score || 0) + (c['tech_stack']?.score || 0) + (c['readme_quality']?.score || 0);

            matrix[rowOffset] = [
              `${r.totalScore}/60 (${r.percentage}%)`,
              r.grade,
              `${profileIdentityScore}/12`,
              `${designationIntroScore}/10`,
              `${skillsScore}/8`,
              `${linksStatsScore}/6`,
              `${reposScore}/12`,
              `${demoQualityScore}/12`,
              r.recommendations.join(' • '),
            ];
          } else if (rowOffset >= 0 && rowOffset < rowCount) {
            matrix[rowOffset] = [
              '0/60 (0%)',
              'Needs Improvement',
              '0/12',
              '0/10',
              '0/8',
              '0/6',
              '0/12',
              '0/12',
              cand.githubFeedback || 'No GitHub link provided',
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

        // 3. Automatically sort the Google Sheet: highest GitHub score descending
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
                        dimensionIndex: startColIdx, // Sort descending by GitHub Score
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
        console.error('Failed to sync GitHub audit results to Google Sheet:', e);
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
