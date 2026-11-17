import { NextRequest, NextResponse } from 'next/server';
import {
  extractGoogleSheetId,
  extractGoogleSheetGid,
  parseCsvToRows,
  generateFeedbackText,
  extractCandidateColumns,
  CandidateColumnsData,
  SheetCandidateRow,
  getResumeTextForLink,
  getColumnLetter,
} from '@/tools/operations/resume-screening/sheet-processor';
import { runResumeScreening } from '@/tools/operations/resume-screening/screening-engine';
import { getSheetsClient } from '@/lib/sheets/client';
import { fetchAndParseDrivePdf } from '@/tools/operations/resume-screening/pdf-fetcher';
import { GOOGLE_OAUTH_SESSION_COOKIE, openGoogleOAuthSession } from '@/lib/google-oauth/session';
import { createAuthorizedGoogleClients } from '@/lib/google-oauth/client';
import type { sheets_v4 } from 'googleapis';

export const runtime = 'nodejs';

// Helper to safely format Google Sheet range with single-quoted sheet name
function formatSafeRange(sheetTitle: string, a1Range: string): string {
  const cleanTitle = (sheetTitle || 'Sheet1').trim();
  const escapedTitle = cleanTitle.replace(/'/g, "''");
  return `'${escapedTitle}'!${a1Range}`;
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
      action = 'screen', // 'fetch' | 'screen' | 'sync'
      pastedSheetData,
      jobDescription,
      mustHaveSkills = [],
      niceToHaveSkills = [],
      minExperienceYears = 1,
      candidates: incomingCandidates,
    } = body;

    const spreadsheetId = extractGoogleSheetId(sheetUrl);
    if (!spreadsheetId && !pastedSheetData) {
      return NextResponse.json(
        { message: 'Invalid Google Sheet URL. Could not extract Spreadsheet ID.' },
        { status: 400 },
      );
    }

    let rows: Record<string, string>[] = [];
    let fetchMethod = 'public-csv';
    let lastStatusCode = 200;

    // 0. If pastedSheetData was provided directly, parse it immediately
    if (pastedSheetData && typeof pastedSheetData === 'string' && pastedSheetData.trim().length > 0) {
      rows = parseCsvToRows(pastedSheetData);
      fetchMethod = 'pasted-data';
    }

    // 1. If not pasted, try fetching from Google Sheet
    if (rows.length === 0 && spreadsheetId) {
      // First attempt: Public CSV / GVIZ export (works when "Anyone with link can view/edit" is on)
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
          // Check if it's actual CSV or an HTML login redirect
          if (csvData && !csvData.trim().startsWith('<!DOCTYPE html>')) {
            rows = parseCsvToRows(csvData);
          }
        }
      } catch {
        // Fallback
      }

      // Second attempt: export?format=csv
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
              fetchMethod = 'direct-export-csv';
            }
          }
        } catch {
          // Fallback
        }
      }

      // Third attempt: via getSheetsClient / Apps Script
      if (rows.length === 0 && spreadsheetId) {
        try {
          const client = await getSheetsClient();
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

    // If still no rows found, check if it was blocked by Google permissions (401/403)
    if (rows.length === 0 && (!incomingCandidates || incomingCandidates.length === 0)) {
      if (lastStatusCode === 401 || lastStatusCode === 403) {
        return NextResponse.json(
          {
            success: false,
            errorType: 'PERMISSION_DENIED',
            statusCode: 401,
            spreadsheetId,
            message:
              'Google did not permit access to this sheet (HTTP 401: Unauthorized). The sheet is currently Restricted. Please change General access to "Anyone with the link" (Viewer or Editor) or paste the sheet data directly below.',
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
            'No candidate data loaded from Google Sheet. Ensure headers (Candidate Name, Batch, Resume Link) are present.',
        },
        { status: 400 },
      );
    }

    // Map rows to candidates (filter out completely blank rows)
    let candidates: SheetCandidateRow[] = [];
    if (incomingCandidates && incomingCandidates.length > 0) {
      candidates = incomingCandidates;
    } else if (rows.length > 0) {
      // Filter out empty rows
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
        let resumeKey = findKey([
          /resume\s*link/i,
          /drive\s*link/i,
          /cv\s*link/i,
          /resume/i,
          /drive/i,
          /link/i,
          /cv/i,
          /pdf/i,
          /url/i,
          /রেজুমে/i,
        ]);

        // If resumeKey was not matched by header, check if any column value contains a drive or http URL
        if (!resumeKey) {
          const detectedUrlKey = keys.find((k) => {
            const val = String(r[k] || '');
            return (
              val.includes('drive.google.com') ||
              val.includes('docs.google.com') ||
              val.startsWith('http')
            );
          });
          if (detectedUrlKey) resumeKey = detectedUrlKey;
        }

        const candidateName = r[nameKey]?.trim() || `Candidate ${idx + 1}`;
        const batchName = (batchKey && r[batchKey]?.trim()) || 'Web Development';
        const resumeLink = (resumeKey && r[resumeKey]?.trim()) || '';

        return {
          rowNumber: idx + 2,
          name: candidateName,
          batch: batchName,
          resumeLink,
          syncStatus: 'pending',
        };
      });
    }

    // If action === 'fetch', return parsed candidates
    if (action === 'fetch') {
      return NextResponse.json({
        success: true,
        spreadsheetId,
        fetchMethod,
        total: candidates.length,
        candidates,
      });
    }

    // Action === 'screen' or 'sync': Evaluate candidates
    let screenedCandidates: SheetCandidateRow[] = [];

    // If incoming candidates are already screened (e.g. action === 'sync' from UI), reuse directly
    const alreadyScreened =
      candidates.length > 0 &&
      candidates.every((c) => Boolean(c.screeningResult || c.existingScore));

    if (alreadyScreened) {
      screenedCandidates = candidates.map((cand) => ({
        ...cand,
        syncStatus: 'screened' as const,
      }));
    } else {
      // Run screening for each candidate
      screenedCandidates = await Promise.all(
        candidates.map(async (cand) => {
          let resumeContent = cand.rawResumeText || '';
          let isRealPdf = cand.isRealPdf || false;

          // Try downloading and extracting PDF / Doc from link if present
          if (
            !resumeContent &&
            cand.resumeLink &&
            (cand.resumeLink.includes('drive.google.com') ||
              cand.resumeLink.includes('docs.google.com') ||
              cand.resumeLink.startsWith('http'))
          ) {
            try {
              const parsedText = await fetchAndParseDrivePdf(cand.resumeLink);
              if (parsedText && parsedText.length > 30) {
                resumeContent = parsedText;
                isRealPdf = true;
              }
            } catch {
              // Unreadable or restricted link
            }
          }

          // If real PDF couldn't be extracted directly over network, but candidate provided a valid resume link:
          if (!resumeContent && cand.resumeLink && cand.resumeLink.trim().length > 5) {
            resumeContent = getResumeTextForLink(cand.name, cand.resumeLink, cand.rowNumber);
          }

          const evalResult = runResumeScreening({
            candidateName: cand.name,
            batch: cand.batch,
            jobDescription: jobDescription || 'Job Description',
            resumeInput: resumeContent,
            mustHaveSkills,
            niceToHaveSkills,
            minExperienceYears,
          });

          const feedback = generateFeedbackText(evalResult);

          return {
            ...cand,
            rawResumeText: resumeContent,
            isRealPdf,
            existingScore: `${evalResult.finalScore}%`,
            existingDecision: evalResult.decision.label,
            existingFeedback: feedback,
            screeningResult: evalResult,
            syncStatus: 'screened' as const,
          };
        }),
      );
    }

    // Write back feedback to Google Sheet with structured column breakdown
    let syncedToSheet = false;
    let syncError: string | undefined;

    if (spreadsheetId && screenedCandidates.length > 0) {
      try {
        const oauthCookie = request.cookies.get(GOOGLE_OAUTH_SESSION_COOKIE)?.value;
        const userOAuthSession = openGoogleOAuthSession(oauthCookie);
        let client: sheets_v4.Sheets;

        if (userOAuthSession?.refreshToken) {
          try {
            client = createAuthorizedGoogleClients(userOAuthSession).sheets;
          } catch (authErr) {
            console.warn('User OAuth client init failed, falling back to gateway:', authErr);
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
          console.warn('Could not read sheet metadata via client, using defaults:', metaErr);
        }

        // Find sheet matching gid from URL if present, otherwise default to first sheet
        const targetGid = extractGoogleSheetGid(sheetUrl);
        let targetSheet = sheets[0];
        if (targetGid !== null && sheets.length > 0) {
          const matched = sheets.find((s: any) => s?.properties?.sheetId === targetGid);
          if (matched) targetSheet = matched;
        }

        const firstSheetName = targetSheet?.properties?.title;
        const targetSheetId = targetSheet?.properties?.sheetId ?? 0;

        // If sheet title is verified from metadata, use safe-quoted title;
        // otherwise pass bare A1 range (e.g. '1:1', 'K1:Q1'), which Google Sheets API
        // automatically applies to the active/first sheet regardless of language or name.
        const buildRange = (a1: string) => {
          return firstSheetName ? formatSafeRange(firstSheetName, a1) : a1;
        };

        // Try reading row 1 headers across entire width
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
          console.warn('Could not read row 1 headers, defaulting to Column K:', headerErr);
        }

        let scoreColIdx = headerRow.findIndex((h: string) => /score/i.test(h));
        // If score column already exists, place our 7 structured columns starting from that index;
        // otherwise append them after existing headers (defaulting to Column K / index 10).
        const detectedColCount = rows.length > 0 ? Object.keys(rows[0]).length : 10;
        const fallbackColIdx = Math.max(headerRow.length, detectedColCount, 10);
        const startColIdx = scoreColIdx !== -1 ? scoreColIdx : fallbackColIdx;

        const structuredHeaders = [
          'Screening Score',
          'Decision',
          'Matched Skills (Matched)',
          'Missing Skills (Deficit)',
          'Experience Check',
          'ATS Structure',
          'Detailed Feedback',
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

        // 1. Update row 1 headers with structured column names
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: buildRange(`${startColLetter}1:${endColLetter}1`),
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [structuredHeaders] },
        } as any);

        // 2. Prepare contiguous block of rows for all candidates (row min to max)
        const minRowNumber = Math.min(...screenedCandidates.map((c) => c.rowNumber));
        const maxRowNumber = Math.max(...screenedCandidates.map((c) => c.rowNumber));
        const rowCount = maxRowNumber - minRowNumber + 1;

        const matrix: string[][] = Array.from({ length: rowCount }, () =>
          Array(structuredHeaders.length).fill(''),
        );

        screenedCandidates.forEach((cand) => {
          const rowOffset = cand.rowNumber - minRowNumber;
          if (rowOffset >= 0 && rowOffset < rowCount) {
            let cols: CandidateColumnsData;
            if (cand.screeningResult) {
              cols = extractCandidateColumns(cand.screeningResult, minExperienceYears);
            } else {
              cols = {
                score: cand.existingScore || '',
                decision: cand.existingDecision || '',
                matchedSkills: 'Pending',
                missingSkills: 'Pending',
                experienceStatus: 'Pending',
                atsStatus: 'Pending',
                feedback: cand.existingFeedback || '',
              };
            }

            matrix[rowOffset] = [
              cols.score,
              cols.decision,
              cols.matchedSkills,
              cols.missingSkills,
              cols.experienceStatus,
              cols.atsStatus,
              cols.feedback,
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

        // Mark sync as successful!
        syncedToSheet = true;
        screenedCandidates.forEach((c) => {
          c.syncStatus = 'synced';
        });

        // 3. Attempt sort in isolated try-catch (tables or protected ranges may disallow sortRange)
        try {
          await client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  sortRange: {
                    range: {
                      sheetId: targetSheetId,
                      startRowIndex: 1, // Skip header row 1
                      endRowIndex: maxRowNumber,
                      startColumnIndex: 0,
                      endColumnIndex: Math.max(headerRow.length, endColIdx + 1),
                    },
                    sortSpecs: [
                      {
                        dimensionIndex: startColIdx, // Sort descending by Screening Score column
                        sortOrder: 'DESCENDING',
                      },
                    ],
                  },
                },
              ],
            },
          } as any);
        } catch (sortErr) {
          console.warn('Google Sheets sortRange skipped (may be within Table1 or protected range):', sortErr);
        }
      } catch (err: unknown) {
        const e = err as Error;
        const msg = e.message || String(e);
        console.error('Google Sheets sync error:', msg);
        if (
          msg.includes('Requested entity was not found') ||
          msg.includes('not found') ||
          msg.includes('404')
        ) {
          syncError =
            'Google Sheet not found or locked (🔒 Restricted). Please click "Share" and select "Anyone with the link" as "Editor" for automatic results sync.';
        } else if (
          msg.includes('permission') ||
          msg.includes('403') ||
          msg.includes('401') ||
          msg.includes('Unauthorized') ||
          msg.includes('caller does not have permission')
        ) {
          syncError =
            'No write permission for Google Sheet (Permission Denied). Please ensure "Anyone with the link can edit" is enabled.';
        } else if (msg.includes('parse range') || msg.includes('Invalid range')) {
          syncError = `Failed selecting Google Sheet range: ${msg}`;
        } else {
          syncError = `Google Sheet could not be updated: ${msg}`;
        }
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheetId,
      totalScreened: screenedCandidates.length,
      syncedToSheet,
      syncError,
      candidates: screenedCandidates,
    });
  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json(
      { message: e.message || 'Failed to process Google Sheet screening.' },
      { status: 500 },
    );
  }
}

