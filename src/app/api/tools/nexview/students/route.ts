import { NextRequest, NextResponse } from 'next/server';
import {
  extractGoogleSheetId,
  parseCsvToRows,
} from '@/tools/operations/resume-screening/sheet-processor';
import { Student, Interview } from '@/tools/operations/nexview/nexview-types';
import {
  getCachedNexViewData,
  updateCachedNexViewData,
} from '@/tools/operations/nexview/nexview-store';

export const runtime = 'nodejs';

export async function GET() {
  const { students, interviews } = getCachedNexViewData();
  return NextResponse.json({
    success: true,
    total: students.length,
    students,
    interviews,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: 'Request data is missing.' },
        { status: 400 },
      );
    }

    const {
      action = 'import',
      student,
      sheetUrl,
      pastedCsv,
      defaultCourse = 'Full Stack Development',
      defaultBatch = 'Batch 10',
    } = body;

    const { students: currentStudents, interviews: currentInterviews } = getCachedNexViewData();
    let studentsCache = [...currentStudents];
    let interviewsCache = [...currentInterviews];

    // 1. Manual Student Creation
    if (action === 'manual') {
      if (!student || !student.name || !student.email) {
        return NextResponse.json(
          { success: false, message: 'Student Name and Email are required.' },
          { status: 400 },
        );
      }

      const cleanEmail = student.email.trim().toLowerCase();
      // Check duplicate
      const existing = studentsCache.find((s) => s.email.toLowerCase() === cleanEmail);
      const studentId = existing?.id || `STU-${Date.now().toString().slice(-4)}`;

      const newStudent: Student = {
        id: studentId,
        name: student.name.trim(),
        email: cleanEmail,
        phone: student.phone?.trim() || '',
        course: student.course || defaultCourse,
        batch: student.batch || defaultBatch,
        level: student.level || 'Level-1',
        slot: student.slot || 'Pending Slot',
        source: 'manual',
        createdAt: new Date().toISOString(),
      };

      if (existing) {
        studentsCache = studentsCache.map((s) => (s.id === studentId ? newStudent : s));
      } else {
        studentsCache.unshift(newStudent);
      }

      // Automatically create or update assigned interview
      let interview = interviewsCache.find((i) => i.studentId === studentId);
      if (!interview) {
        interview = {
          id: `INT-${studentId}`,
          studentId,
          student: newStudent,
          course: newStudent.course,
          batch: newStudent.batch,
          status: 'Assigned',
        };
        interviewsCache.unshift(interview);
      } else {
        interview.student = newStudent;
      }

      updateCachedNexViewData(studentsCache, interviewsCache);

      return NextResponse.json({
        success: true,
        message: 'Candidate created successfully and interview session assigned.',
        student: newStudent,
        interview,
      });
    }

    // 2. Batch Google Sheet / CSV Import
    if (action === 'import') {
      let rows: Record<string, string>[] = [];

      // A. If pasted CSV provided
      if (pastedCsv && typeof pastedCsv === 'string' && pastedCsv.trim().length > 0) {
        rows = parseCsvToRows(pastedCsv);
      }

      // B. If Google Sheet URL provided
      if (rows.length === 0 && sheetUrl) {
        const spreadsheetId = extractGoogleSheetId(sheetUrl);
        if (spreadsheetId) {
          try {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
            const res = await fetch(exportUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/csv,text/plain,*/*',
              },
              cache: 'no-store',
            });
            if (res.ok) {
              const csvText = await res.text();
              if (csvText && !csvText.trim().startsWith('<!DOCTYPE html>')) {
                rows = parseCsvToRows(csvText);
              }
            }
          } catch {
            // Fallback
          }
        }
      }

      if (rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              'No student data found from sheet. Please verify sheet link or CSV data.',
          },
          { status: 400 },
        );
      }

      const importedStudents: Student[] = [];

      rows.forEach((r, idx) => {
        const keys = Object.keys(r);
        const findKey = (patterns: RegExp[]) =>
          keys.find((k) => patterns.some((p) => p.test(k.toLowerCase())));

        const nameKey = findKey([/^name$/i, /student\s*name/i, /candidate\s*name/i, /full\s*name/i, /নাম/i]) || keys[0];
        const emailKey = findKey([/email/i, /e-mail/i, /ইমেইল/i]);
        const phoneKey = findKey([/phone/i, /mobile/i, /contact/i, /ফোন/i]);
        const courseKey = findKey([/course/i, /track/i, /কোর্স/i]);
        const batchKey = findKey([/batch/i, /cohort/i, /ব্যাচ/i]);
        const slotKey = findKey([/slot/i, /time/i, /স্লট/i, /schedule/i]);

        const rawName = r[nameKey]?.trim();
        const rawEmail = (emailKey ? r[emailKey] : '')?.trim().toLowerCase();

        if (!rawName || !rawEmail || !rawEmail.includes('@')) return;

        const studentId = `STU-${Date.now().toString().slice(-4)}-${idx + 1}`;
        const studentObj: Student = {
          id: studentId,
          name: rawName,
          email: rawEmail,
          phone: phoneKey ? r[phoneKey]?.trim() : '',
          course: (courseKey && r[courseKey]?.trim()) || defaultCourse,
          batch: (batchKey && r[batchKey]?.trim()) || defaultBatch,
          level: 'Level-1',
          slot: (slotKey && r[slotKey]?.trim()) || `Slot ${idx + 1}`,
          source: 'google_sheet',
          metadata: r,
          createdAt: new Date().toISOString(),
        };

        // Duplicate merge
        const existingIdx = studentsCache.findIndex((s) => s.email.toLowerCase() === rawEmail);
        if (existingIdx !== -1) {
          studentsCache[existingIdx] = { ...studentsCache[existingIdx], ...studentObj };
          importedStudents.push(studentsCache[existingIdx]);
        } else {
          studentsCache.push(studentObj);
          importedStudents.push(studentObj);

          // Automatically assign interview
          const interviewObj: Interview = {
            id: `INT-${studentId}`,
            studentId,
            student: studentObj,
            course: studentObj.course,
            batch: studentObj.batch,
            status: 'Assigned',
          };
          interviewsCache.push(interviewObj);
        }
      });

      updateCachedNexViewData(studentsCache, interviewsCache);

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${importedStudents.length} candidates and assigned interview sessions.`,
        importedCount: importedStudents.length,
        students: studentsCache,
        interviews: interviewsCache,
      });
    }

    return NextResponse.json({ success: false, message: 'Unknown action requested.' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json(
      { success: false, message: e.message || 'Failed to process candidate data.' },
      { status: 500 },
    );
  }
}
