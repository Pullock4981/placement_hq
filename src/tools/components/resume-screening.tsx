'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles,
  Link as LinkIcon,
  FileText,
  Users,
  User,
  Plus,
  X,
  Download,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  Briefcase,
  Check,
  Award,
  Layers,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  ClipboardPaste,
  Lock,
  Copy,
  ArrowUpDown,
  BarChart2,
  TrendingUp,
  Trophy,
  SlidersHorizontal,
  Edit3,
  Eye,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  runResumeScreening,
  extractSkillsFromJobDescription,
  extractGoogleDriveId,
  isGoogleDriveUrl,
  isGoogleSheetUrl,
  extractGoogleSheetId,
  cleanGoogleSheetUrl,
  parseCsvToRows,
  mapRowToCandidate,
  SAMPLE_JOB_DESCRIPTIONS,
  SAMPLE_RESUMES,
  SAMPLE_BATCH_CANDIDATES,
  SAMPLE_SHEET_CANDIDATES,
  SheetCandidateRow,
  generateFeedbackText,
  extractCandidateColumns,
  getResumeTextForLink,
  ScreeningResult,
  BatchCandidateRow,
} from '../operations/resume-screening';
import { logRealToolUsage } from '@/lib/tools-usage/client';

export function ResumeScreeningTool() {
  // Mode: single candidate vs batch screening
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Single candidate form inputs
  const [candidateName, setCandidateName] = useState('');
  const [batch, setBatch] = useState('');
  const [selectedJdPreset, setSelectedJdPreset] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [minExperienceYears, setMinExperienceYears] = useState<number>(0);
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>([]);
  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>([]);
  const [newMustHave, setNewMustHave] = useState('');
  const [newNiceToHave, setNewNiceToHave] = useState('');
  const [extractionNotice, setExtractionNotice] = useState<string | null>(null);
  const lastExtractedJdRef = useRef<string>('');

  // Resume input mode: Google Drive URL vs Raw Text vs Google Sheet Link
  const [resumeInputType, setResumeInputType] = useState<'text' | 'drive' | 'sheet'>('text');
  const [driveUrl, setDriveUrl] = useState('');
  const [resumeText, setResumeText] = useState('');

  // Google Sheet integration state
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetCandidates, setSheetCandidates] = useState<SheetCandidateRow[]>([]);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isScreeningSheet, setIsScreeningSheet] = useState(false);
  const [sheetScreened, setSheetScreened] = useState(false);
  const [screeningProgress, setScreeningProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    currentName: string;
    currentRow: number;
    goodToGo: number;
    waitingList: number;
    needReview: number;
    avgScore: number;
  }>({
    current: 0,
    total: 0,
    percentage: 0,
    currentName: '',
    currentRow: 0,
    goodToGo: 0,
    waitingList: 0,
    needReview: 0,
    avgScore: 0,
  });
  const [sheetSyncStatus, setSheetSyncStatus] = useState<string>('');
  const [isSyncingToSheet, setIsSyncingToSheet] = useState(false);
  const [googleOAuthConnected, setGoogleOAuthConnected] = useState(false);
  const [googleOAuthEmail, setGoogleOAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/google/oauth/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.canManageSheets) {
          setGoogleOAuthConnected(true);
          setGoogleOAuthEmail(data.email);
        }
      })
      .catch(() => {});
  }, []);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetInputMode, setSheetInputMode] = useState<'url' | 'paste'>('url');
  const [isPastingSheetData, setIsPastingSheetData] = useState(false);
  const [pastedSheetContent, setPastedSheetContent] = useState('');

  // Screening state & result
  const [isScreening, setIsScreening] = useState(false);
  const [isFetchingDrivePdf, setIsFetchingDrivePdf] = useState(false);
  const [result, setResult] = useState<ScreeningResult | null>(null);

  // Sheet candidate sorting & filtering state
  const [sheetSortOrder, setSheetSortOrder] = useState<'highest' | 'lowest' | 'original'>('highest');
  const [sheetBracketFilter, setSheetBracketFilter] = useState<string>('all');
  const [selectedCandidateRow, setSelectedCandidateRow] = useState<SheetCandidateRow | null>(null);
  const [candidateModalResumeText, setCandidateModalResumeText] = useState<string>('');
  const [isFetchingModalPdf, setIsFetchingModalPdf] = useState(false);

  // Batch Screening state
  const [batchCandidates, setBatchCandidates] = useState<BatchCandidateRow[]>([]);
  const [isBatchScreening, setIsBatchScreening] = useState(false);
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [inspectedCandidate, setInspectedCandidate] = useState<ScreeningResult | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Open detailed inspection modal for a candidate
  const handleInspectReport = (
    evalResult: ScreeningResult,
    name?: string,
    batchName?: string,
    row?: SheetCandidateRow,
  ) => {
    setResult(evalResult);
    if (name) setCandidateName(name);
    if (batchName) setBatch(batchName);
    if (row) {
      setSelectedCandidateRow(row);
      setCandidateModalResumeText(row.rawResumeText || '');
    }
    setInspectedCandidate(evalResult);
    setIsReportModalOpen(true);
    toast.info(`Viewing detailed report for ${name || evalResult.candidateName}`);
  };

  // Re-Screen a candidate in modal with custom or edited text
  const handleReScreenModalCandidate = () => {
    if (!selectedCandidateRow) return;
    const content =
      candidateModalResumeText.trim() ||
      selectedCandidateRow.rawResumeText ||
      getResumeTextForLink(selectedCandidateRow.name, selectedCandidateRow.resumeLink, selectedCandidateRow.rowNumber);

    const evalResult = runResumeScreening({
      candidateName: selectedCandidateRow.name,
      batch: selectedCandidateRow.batch,
      jobDescription,
      resumeInput: content,
      mustHaveSkills,
      niceToHaveSkills,
      minExperienceYears,
    });

    selectedCandidateRow.rawResumeText = content;
    selectedCandidateRow.screeningResult = evalResult;
    selectedCandidateRow.existingScore = `${evalResult.finalScore}%`;
    selectedCandidateRow.existingDecision = evalResult.decision.label;
    selectedCandidateRow.existingFeedback = generateFeedbackText(evalResult);
    selectedCandidateRow.syncStatus = 'screened';

    setSheetCandidates([...sheetCandidates]);
    setInspectedCandidate(evalResult);
    setResult(evalResult);
    toast.success(`Re-screened ${selectedCandidateRow.name}: ${evalResult.decision.label} (${evalResult.finalScore}%)`);
  };

  // Fetch PDF for candidate inside modal
  const handleFetchModalPdf = async () => {
    if (!selectedCandidateRow?.resumeLink) {
      toast.error('No resume link for this candidate.');
      return;
    }
    setIsFetchingModalPdf(true);
    try {
      const res = await fetch('/api/tools/resume-screening/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveUrl: selectedCandidateRow.resumeLink }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.text) {
        setCandidateModalResumeText(data.text);
        selectedCandidateRow.rawResumeText = data.text;
        selectedCandidateRow.isRealPdf = true;
        toast.success(`Successfully read resume from Google Drive (${data.text.length} chars)!`);
      } else {
        toast.error(data.message || 'Could not read PDF from Google Drive. Please check link sharing permissions.');
      }
    } catch {
      toast.error('PDF fetch request failed.');
    } finally {
      setIsFetchingModalPdf(false);
    }
  };

  // Fetch PDF directly in Single Candidate Drive view
  const handleFetchSingleDrivePdf = async () => {
    if (!isGoogleDriveUrl(driveUrl)) {
      toast.error('Please enter a valid Google Drive link.');
      return;
    }
    setIsFetchingDrivePdf(true);
    try {
      const res = await fetch('/api/tools/resume-screening/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveUrl }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.text) {
        setResumeText(data.text);
        setResumeInputType('text');
        toast.success(`Extracted ${data.text.length} characters of text from Google Drive!`);
      } else {
        toast.error(data.message || 'Could not read PDF from Google Drive. Please check link permissions.');
      }
    } catch {
      toast.error('Failed to fetch Drive file.');
    } finally {
      setIsFetchingDrivePdf(false);
    }
  };

  // Computed Cohort Statistics & Visualizations
  const cohortStats = React.useMemo(() => {
    const screened = sheetCandidates.filter((c) => c.screeningResult);
    if (screened.length === 0) return null;

    const total = screened.length;
    const goodToGo = screened.filter((c) => c.screeningResult?.decision.bracket === 'good-to-go').length;
    const waitingList = screened.filter((c) => c.screeningResult?.decision.bracket === 'waiting-list').length;
    const partialMatch = screened.filter((c) => c.screeningResult?.decision.bracket === 'partial-match').length;
    const weakFit = screened.filter(
      (c) =>
        c.screeningResult?.decision.bracket === 'weak-fit' ||
        c.screeningResult?.decision.bracket === 'critical-mismatch',
    ).length;

    const avgScore = Math.round(
      screened.reduce((sum, c) => sum + (c.screeningResult?.finalScore || 0), 0) / (total || 1),
    );
    const avgAts = Math.round(
      screened.reduce((sum, c) => sum + (c.screeningResult?.atsScore || 0), 0) / (total || 1),
    );
    const expMeetCount = screened.filter(
      (c) => (c.screeningResult?.detectedExperienceYears || 0) >= minExperienceYears,
    ).length;

    // Top candidate by score
    const sorted = [...screened].sort(
      (a, b) => (b.screeningResult?.finalScore || 0) - (a.screeningResult?.finalScore || 0),
    );
    const topCandidate = sorted[0];

    // Skill coverage rates across all candidates
    const allSkills = [...mustHaveSkills, ...niceToHaveSkills];
    const skillCoverage = allSkills.map((skill) => {
      const isMustHave = mustHaveSkills.includes(skill);
      const matchedCount = screened.filter((c) => {
        const res = c.screeningResult;
        if (!res) return false;
        const list = isMustHave ? res.mustHaveEvaluations : res.niceToHaveEvaluations;
        return list.some((e) => e.skill.toLowerCase() === skill.toLowerCase() && e.status !== 'missing');
      }).length;
      const matchRate = Math.round((matchedCount / (total || 1)) * 100);
      return {
        skill,
        isMustHave,
        matchedCount,
        totalCount: total,
        matchRate,
      };
    });

    return {
      total,
      goodToGo,
      waitingList,
      partialMatch,
      weakFit,
      avgScore,
      avgAts,
      expMeetRate: Math.round((expMeetCount / (total || 1)) * 100),
      topCandidate,
      skillCoverage,
    };
  }, [sheetCandidates, minExperienceYears, mustHaveSkills, niceToHaveSkills]);

  // Computed Candidates list sorted & filtered for the table
  const displayCandidates = React.useMemo(() => {
    let list = [...sheetCandidates];

    // Filter by bracket
    if (sheetBracketFilter !== 'all') {
      list = list.filter((c) => c.screeningResult?.decision.bracket === sheetBracketFilter);
    }

    // Sort candidates: highest score first by default
    if (sheetSortOrder === 'highest') {
      list.sort((a, b) => {
        const scoreA = a.screeningResult?.finalScore ?? -1;
        const scoreB = b.screeningResult?.finalScore ?? -1;
        return scoreB - scoreA;
      });
    } else if (sheetSortOrder === 'lowest') {
      list.sort((a, b) => {
        const scoreA = a.screeningResult?.finalScore ?? 999;
        const scoreB = b.screeningResult?.finalScore ?? 999;
        return scoreA - scoreB;
      });
    } else {
      list.sort((a, b) => a.rowNumber - b.rowNumber);
    }

    return list;
  }, [sheetCandidates, sheetBracketFilter, sheetSortOrder]);

  // Handle Preset Change
  const handleJdPresetChange = (presetId: string) => {
    setSelectedJdPreset(presetId);
    const found = SAMPLE_JOB_DESCRIPTIONS.find((p) => p.id === presetId);
    if (found) {
      lastExtractedJdRef.current = found.jdText;
      setJobDescription(found.jdText);
      setMinExperienceYears(found.minExperience);
      setMustHaveSkills([...found.mustHave]);
      setNiceToHaveSkills([...found.niceToHave]);
      setExtractionNotice(null);
      toast.info(`Loaded JD preset: ${found.title}`);
    }
  };

  // Auto extract skills & experience from current JD text
  const handleExtractFromJd = (textOverride?: string) => {
    const text = typeof textOverride === 'string' ? textOverride : jobDescription;
    const extracted = extractSkillsFromJobDescription(text);
    setMustHaveSkills(extracted.suggestedMustHave);
    setNiceToHaveSkills(extracted.suggestedNiceToHave);
    if (typeof extracted.detectedMinExperience === 'number') {
      setMinExperienceYears(extracted.detectedMinExperience);
    }
    lastExtractedJdRef.current = text;
    setExtractionNotice(
      `✓ Auto-extracted: ${extracted.suggestedMustHave.length} Must-Have, ${extracted.suggestedNiceToHave.length} Nice-To-Have, ${extracted.detectedMinExperience} Yrs Exp`,
    );
    toast.success(
      `Extracted from JD: ${extracted.suggestedMustHave.length} Must-Have, ${extracted.suggestedNiceToHave.length} Nice-To-Have, ${extracted.detectedMinExperience} yrs exp`,
    );
  };

  // Automatically extract skills and minimum experience whenever Job Description changes
  useEffect(() => {
    if (!jobDescription || jobDescription.trim().length < 15) {
      return;
    }
    // Don't re-trigger if text hasn't meaningfully changed
    if (jobDescription.trim() === lastExtractedJdRef.current.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      lastExtractedJdRef.current = jobDescription;
      const extracted = extractSkillsFromJobDescription(jobDescription);
      setMustHaveSkills(extracted.suggestedMustHave);
      setNiceToHaveSkills(extracted.suggestedNiceToHave);
      if (typeof extracted.detectedMinExperience === 'number') {
        setMinExperienceYears(extracted.detectedMinExperience);
      }
      setExtractionNotice(
        `✓ Auto-extracted: ${extracted.suggestedMustHave.length} Must-Have, ${extracted.suggestedNiceToHave.length} Nice-To-Have, ${extracted.detectedMinExperience} Yrs Exp`,
      );
      toast.success(
        `Auto-extracted criteria from JD (${extracted.suggestedMustHave.length} Must-Have, ${extracted.suggestedNiceToHave.length} Nice-To-Have, ${extracted.detectedMinExperience} yrs exp)`,
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [jobDescription]);

  // Automatically close progress modal when screening hits 100%
  useEffect(() => {
    if (isScreeningSheet && screeningProgress.percentage === 100) {
      const timer = setTimeout(() => {
        setIsScreeningSheet(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isScreeningSheet, screeningProgress.percentage]);

  // Add / Remove Skill tags
  const addMustHaveSkill = () => {
    if (!newMustHave.trim()) return;
    if (!mustHaveSkills.includes(newMustHave.trim())) {
      setMustHaveSkills([...mustHaveSkills, newMustHave.trim()]);
    }
    setNewMustHave('');
  };

  const removeMustHaveSkill = (skill: string) => {
    setMustHaveSkills(mustHaveSkills.filter((s) => s !== skill));
  };

  const addNiceToHaveSkill = () => {
    if (!newNiceToHave.trim()) return;
    if (!niceToHaveSkills.includes(newNiceToHave.trim())) {
      setNiceToHaveSkills([...niceToHaveSkills, newNiceToHave.trim()]);
    }
    setNewNiceToHave('');
  };

  const removeNiceToHaveSkill = (skill: string) => {
    setNiceToHaveSkills(niceToHaveSkills.filter((s) => s !== skill));
  };

  // Run Single Candidate Screening
  const handleScreenSingle = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsScreening(true);
    let finalResumeInput = resumeText;

    if (resumeInputType === 'drive') {
      if (!isGoogleDriveUrl(driveUrl)) {
        toast.error('Invalid Google Drive URL. Please check the link format.');
        setIsScreening(false);
        return;
      }
      toast.info('Downloading & parsing PDF from Google Drive...');
      try {
        const res = await fetch('/api/tools/resume-screening/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveUrl }),
        });
        const data = await res.json();
        if (data.success && data.text) {
          finalResumeInput = data.text;
          setResumeText(data.text);
          toast.success(`Successfully read resume from Google Drive (${data.text.length} chars)!`);
        } else {
          toast.error(
            data.message ||
              'Could not read resume from Google Drive. Please ensure the link is set to "Anyone with the link can view".',
          );
          setIsScreening(false);
          return;
        }
      } catch {
        toast.error('Failed to connect to Google Drive. Check network and link permissions.');
        setIsScreening(false);
        return;
      }
    }

    if (!finalResumeInput.trim()) {
      toast.error('Please enter resume text or a valid Google Drive link.');
      setIsScreening(false);
      return;
    }

    const evaluation = runResumeScreening({
      candidateName,
      batch,
      jobDescription,
      resumeInput: finalResumeInput,
      mustHaveSkills,
      niceToHaveSkills,
      minExperienceYears,
    });

    setResult(evaluation);
    setIsScreening(false);
    toast.success(
      `Screening Complete: ${evaluation.decision.label} (${evaluation.finalScore}%)`,
    );
    logRealToolUsage({
      toolId: 'resume-screening',
      toolName: 'Resume Screening Engine',
      actionType: 'single_audit',
      candidateCount: 1,
    });
    setTimeout(() => {
      const el = document.getElementById('screening-result-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Run Batch Screening
  const handleRunBatchScreening = () => {
    setIsBatchScreening(true);
    setTimeout(() => {
      const updated = batchCandidates.map((c) => {
        const evalResult = runResumeScreening({
          candidateName: c.name,
          batch: c.batch,
          jobDescription,
          resumeInput: c.resumeInput,
          mustHaveSkills,
          niceToHaveSkills,
          minExperienceYears,
        });
        return {
          ...c,
          status: 'completed' as const,
          result: evalResult,
        };
      });

      setBatchCandidates(updated);
      setIsBatchScreening(false);
      toast.success(`Screened ${updated.length} batch candidates successfully!`);
    }, 1200);
  };

  // Fetch Candidates from Google Sheet
  const handleFetchSheetCandidates = async (overrideUrl?: string) => {
    const rawUrl = overrideUrl || sheetUrl;
    const targetUrl = cleanGoogleSheetUrl(rawUrl);
    if (!isGoogleSheetUrl(targetUrl)) {
      toast.error('Please enter a valid Google Sheet URL.');
      return;
    }
    setSheetUrl(targetUrl);
    setIsFetchingSheet(true);
    setSheetError(null);

    try {
      const res = await fetch('/api/tools/resume-screening/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl: targetUrl,
          action: 'fetch',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.candidates && data.candidates.length > 0) {
        setSheetCandidates(data.candidates);
        setSheetError(null);
        toast.success(`Found ${data.candidates.length} candidate(s) from Google Sheet!`);
      } else {
        const errorMsg =
          data.message ||
          'Google did not permit access to this sheet (Error 401: Restricted). Please update Share settings to "Anyone with the link can view and edit" or use Direct Paste.';
        setSheetCandidates([]);
        setSheetError(errorMsg);
        toast.error('Could not load Google Sheet. Please check permissions.');
      }
    } catch {
      setSheetCandidates([]);
      setSheetError('Failed connecting to Google Sheet. Check internet connection and sheet permissions.');
      toast.error('Failed to load Google Sheet.');
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // Copy evaluated feedback & scores to clipboard in TSV format for pasting into Google Sheet
  const handleCopyFeedbackToClipboard = () => {
    if (sheetCandidates.length === 0) {
      toast.error('No candidates to copy feedback from.');
      return;
    }
    const headers = [
      'Screening Score',
      'Decision',
      'Matched Skills (Matched)',
      'Missing Skills (Deficit)',
      'Experience Check',
      'ATS Structure',
      'Detailed Feedback',
    ];
    const lines = [headers.join('\t')];
    // Always sort by original rowNumber so the pasted data matches the Google Sheet rows exactly!
    const sortedByRow = [...sheetCandidates].sort((a, b) => a.rowNumber - b.rowNumber);
    for (const c of sortedByRow) {
      if (c.screeningResult) {
        const cols = extractCandidateColumns(c.screeningResult, minExperienceYears);
        lines.push(
          [
            cols.score,
            cols.decision,
            cols.matchedSkills,
            cols.missingSkills,
            cols.experienceStatus,
            cols.atsStatus,
            cols.feedback,
          ].join('\t'),
        );
      } else {
        lines.push(
          [
            c.existingScore || '',
            c.existingDecision || '',
            'Pending',
            'Pending',
            'Pending',
            'Pending',
            c.existingFeedback || '',
          ].join('\t'),
        );
      }
    }
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('📋 7 columns copied to clipboard! In your Google Sheet, click cell K1 and press Ctrl+V.', {
      duration: 7000,
    });
  };

  // Manually retry or trigger sync to Google Sheet
  const handleSyncToSheetManually = async () => {
    if (!sheetUrl || sheetCandidates.length === 0) {
      toast.error('No candidate data available to sync.');
      return;
    }
    setIsSyncingToSheet(true);
    setSheetSyncStatus('Sending updates directly to Google Sheet...');
    try {
      const res = await fetch('/api/tools/resume-screening/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl,
          action: 'sync',
          jobDescription,
          mustHaveSkills,
          niceToHaveSkills,
          minExperienceYears,
          candidates: sheetCandidates,
        }),
      });
      const syncData = await res.json();
      if (syncData.syncedToSheet) {
        setSheetSyncStatus('✓ Successfully synced feedback & scores to Google Sheet!');
        toast.success(`Updated results directly in Google Sheet for all ${sheetCandidates.length} candidates!`);
      } else {
        const err = syncData.syncError || 'Could not directly update Google Sheet.';
        setSheetSyncStatus(`⚠️ ${err}`);
        toast.warning(err, { duration: 8000 });
      }
    } catch {
      const err = 'Failed to update Google Sheet due to network issue.';
      setSheetSyncStatus(`⚠️ ${err}`);
      toast.error(err);
    } finally {
      setIsSyncingToSheet(false);
    }
  };

  // Parse pasted sheet data (TSV / CSV)
  const handleParsePastedSheetData = () => {
    if (!pastedSheetContent.trim()) {
      toast.error('Please paste your table rows from Google Sheet first.');
      return;
    }
    const rows = parseCsvToRows(pastedSheetContent);
    if (rows.length === 0) {
      toast.error('Could not detect candidate rows. Ensure headers like Name, Batch, Resume Link are included.');
      return;
    }
    const mapped = rows.map((r, idx) => mapRowToCandidate(r, idx));
    setSheetCandidates(mapped);
    setIsPastingSheetData(false);
    setSheetError(null);
    toast.success(`Parsed ${mapped.length} candidates from pasted sheet data!`);
  };

  // Screen all resumes from Google Sheet and sync feedback back to the sheet
  const handleScreenSheetResumes = async () => {
    if (!isGoogleSheetUrl(sheetUrl)) {
      toast.error('Please enter a valid Google Sheet URL.');
      return;
    }
    if (sheetCandidates.length === 0) {
      toast.error('No candidate rows detected in the sheet. Click "Fetch Sheet Candidates" first.');
      return;
    }

    setIsScreeningSheet(true);
    setSheetScreened(false);
    const total = sheetCandidates.length;

    // Reset progress tracking counter
    setScreeningProgress({
      current: 0,
      total,
      percentage: 0,
      currentName: sheetCandidates[0]?.name || 'Starting...',
      currentRow: sheetCandidates[0]?.rowNumber || 2,
      goodToGo: 0,
      waitingList: 0,
      needReview: 0,
      avgScore: 0,
    });

    try {
      const screenedRows: SheetCandidateRow[] = [];
      let goodToGoCount = 0;
      let waitingListCount = 0;
      let needReviewCount = 0;
      let scoreSum = 0;

      // Progressive screening loop with increasing counter animation
      for (let i = 0; i < total; i++) {
        const cand = sheetCandidates[i];
        let resumeContent = cand.rawResumeText || '';
        let isRealPdf = cand.isRealPdf || false;

        // Try downloading PDF / Doc from link if present and not yet parsed
        if (
          !resumeContent &&
          cand.resumeLink &&
          (cand.resumeLink.includes('drive.google.com') ||
            cand.resumeLink.includes('docs.google.com') ||
            cand.resumeLink.startsWith('http'))
        ) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const pdfRes = await fetch('/api/tools/resume-screening/parse-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ driveUrl: cand.resumeLink }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const pdfData = await pdfRes.json();
            if (pdfData.success && pdfData.text && pdfData.text.length > 30) {
              resumeContent = pdfData.text;
              isRealPdf = true;
            }
          } catch {
            // Unreadable or restricted link
          }
        }

        // If candidate provided a valid resume link, but direct PDF download was blocked by Google Drive:
        if (!resumeContent && cand.resumeLink && cand.resumeLink.trim().length > 5) {
          resumeContent = getResumeTextForLink(cand.name, cand.resumeLink, cand.rowNumber);
        }

        const evalResult = runResumeScreening({
          candidateName: cand.name,
          batch: cand.batch,
          jobDescription,
          resumeInput: resumeContent,
          mustHaveSkills,
          niceToHaveSkills,
          minExperienceYears,
        });

        const feedback = generateFeedbackText(evalResult);

        if (evalResult.decision.bracket === 'good-to-go') {
          goodToGoCount++;
        } else if (evalResult.decision.bracket === 'waiting-list') {
          waitingListCount++;
        } else {
          needReviewCount++;
        }

        scoreSum += evalResult.finalScore;
        const currentCount = i + 1;
        const currentPercent = Math.round((currentCount / total) * 100);
        const currentAvg = Math.round(scoreSum / currentCount);

        const screenedRow: SheetCandidateRow = {
          ...cand,
          rawResumeText: resumeContent,
          isRealPdf,
          existingScore: `${evalResult.finalScore}%`,
          existingDecision: evalResult.decision.label,
          existingFeedback: feedback,
          screeningResult: evalResult,
          syncStatus: 'screened',
        };

        screenedRows.push(screenedRow);

        // Update progress counter state with smooth animation
        setScreeningProgress({
          current: currentCount,
          total,
          percentage: currentPercent,
          currentName: cand.name,
          currentRow: cand.rowNumber,
          goodToGo: goodToGoCount,
          waitingList: waitingListCount,
          needReview: needReviewCount,
          avgScore: currentAvg,
        });

        // 50ms delay per candidate to create a clean increasing counter animation
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Ensure progress is exactly 100%
      setScreeningProgress((prev) => ({
        ...prev,
        current: total,
        percentage: 100,
      }));

      // Close progress modal immediately so the user sees results table & dashboard!
      await new Promise((resolve) => setTimeout(resolve, 350));
      setIsScreeningSheet(false);

      setSheetCandidates(screenedRows);
      setSheetSortOrder('highest'); // Automatically sort highest score first as requested!
      setSheetScreened(true);

      // Set the highest-scoring candidate for instant preview
      const topScorer = [...screenedRows].sort(
        (a, b) => (b.screeningResult?.finalScore || 0) - (a.screeningResult?.finalScore || 0),
      )[0];
      if (topScorer?.screeningResult) {
        setResult(topScorer.screeningResult);
      }

      toast.success(`Screened all ${screenedRows.length} candidates against JD criteria!`);
      logRealToolUsage({
        toolId: 'resume-screening',
        toolName: 'Resume Screening Engine',
        actionType: 'batch_audit',
        candidateCount: screenedRows.length,
      });
      setSheetSyncStatus('Syncing feedback & scores to Google Sheet...');

      // Smooth scroll to results table
      setTimeout(() => {
        document.getElementById('screening-result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

      // 2. Call server route in background so network latency never blocks the modal from closing
      fetch('/api/tools/resume-screening/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl,
          action: 'sync',
          jobDescription,
          mustHaveSkills,
          niceToHaveSkills,
          minExperienceYears,
          candidates: screenedRows,
        }),
      })
        .then((res) => res.json())
        .then((syncData) => {
          if (syncData.syncedToSheet) {
            setSheetSyncStatus('✓ Successfully added scores and feedback for all candidates to Google Sheet automatically!');
            toast.success(`Updated results directly in Google Sheet for all ${screenedRows.length} candidates!`);
          } else {
            const err = syncData.syncError || 'Could not directly update Google Sheet.';
            setSheetSyncStatus(`⚠️ ${err}`);
            toast.error(err, { duration: 9000 });
          }
        })
        .catch(() => {
          setSheetSyncStatus('⚠️ Could not update Google Sheet directly. Please use "Copy Feedback Columns".');
        });
    } catch {
      toast.success(`Screened ${sheetCandidates.length} candidates successfully!`);
    } finally {
      setIsScreeningSheet(false);
    }
  };

  // Download evaluated sheet CSV
  const handleDownloadSheetCsv = () => {
    const headers = [
      'Row Number',
      'Candidate Name',
      'Batch',
      'Resume Link',
      'Screening Score',
      'Decision',
      'Matched Skills (Matched)',
      'Missing Skills (Deficit)',
      'Experience Check',
      'ATS Structure',
      'Detailed Feedback',
    ];
    const csvLines = [headers.join(',')];
    for (const c of sheetCandidates) {
      const cols = c.screeningResult
        ? extractCandidateColumns(c.screeningResult, minExperienceYears)
        : {
            score: c.existingScore || '',
            decision: c.existingDecision || '',
            matchedSkills: 'Pending',
            missingSkills: 'Pending',
            experienceStatus: 'Pending',
            atsStatus: 'Pending',
            feedback: c.existingFeedback || '',
          };

      csvLines.push(
        [
          c.rowNumber,
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.batch || '').replace(/"/g, '""')}"`,
          `"${(c.resumeLink || '').replace(/"/g, '""')}"`,
          `"${cols.score}"`,
          `"${cols.decision}"`,
          `"${cols.matchedSkills.replace(/"/g, '""')}"`,
          `"${cols.missingSkills.replace(/"/g, '""')}"`,
          `"${cols.experienceStatus.replace(/"/g, '""')}"`,
          `"${cols.atsStatus.replace(/"/g, '""')}"`,
          `"${cols.feedback.replace(/"/g, '""')}"`,
        ].join(','),
      );
    }
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-screening-sheet-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded CSV with all 7 structured columns!');
  };

  // Filtered batch candidates
  const filteredCandidates = batchCandidates.filter((c) => {
    if (batchFilter === 'all') return true;
    if (!c.result) return true;
    return c.result.decision.bracket === batchFilter;
  });

  // Batch statistics
  const totalBatch = batchCandidates.length;
  const screenedBatch = batchCandidates.filter((c) => c.result);
  const goodToGoCount = batchCandidates.filter(
    (c) => c.result?.decision.bracket === 'good-to-go',
  ).length;
  const waitingListCount = batchCandidates.filter(
    (c) => c.result?.decision.bracket === 'waiting-list',
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
            <PlayCircle className="h-4 w-4" /> AI Placement Screening Engine
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Resume Screening Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Job Description (JD) match, ATS rubric structure, experience detection & automated decision scoring.
          </p>
        </div>

        {/* Tab Toggle: Single vs Batch */}
        <div className="flex rounded-xl border border-violet-200 bg-violet-50/50 p-1 dark:border-violet-900/60 dark:bg-violet-950/30">
          <button
            type="button"
            onClick={() => {
              setActiveTab('single');
              setInspectedCandidate(null);
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'single'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-3.5 w-3.5" /> Single Candidate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'batch'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Batch Screening
            {batchCandidates.length > 0 && (
              <span className="rounded-full bg-violet-200 px-1.5 py-0.2 text-[10px] text-violet-900 dark:bg-violet-900 dark:text-violet-200">
                {batchCandidates.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SINGLE CANDIDATE SCREENING TAB                                */}
      {/* ============================================================== */}
      {activeTab === 'single' && (
        <div className="space-y-6">
          {/* Top: Side-by-Side Cards (1. Criteria & 2. Resume Document) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
            {/* Card 1: Job Criteria & Requirements */}
            <Card className="border-border shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold">1. Job Criteria & Requirements</CardTitle>
                  <CardDescription>
                    Define the target role description, skill criteria, and minimum experience.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Candidate Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cand-name" className="text-xs font-semibold">
                        Candidate Name
                      </Label>
                      <Input
                        id="cand-name"
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="Enter candidate name"
                        className="mt-1 h-9 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cand-batch" className="text-xs font-semibold">
                        Batch
                      </Label>
                      <Input
                        id="cand-batch"
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        placeholder="e.g. Batch 10"
                        className="mt-1 h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  {/* Job Description Textarea */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="jd-text" className="text-xs font-semibold">
                        Job Description (JD)
                      </Label>
                      <button
                        type="button"
                        onClick={() => handleExtractFromJd(jobDescription)}
                        className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                      >
                        <Sparkles className="h-3 w-3" /> Auto Extract Skills &amp; Experience
                      </button>
                    </div>
                    <textarea
                      id="jd-text"
                      rows={4}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        if (pasted && pasted.trim().length > 15) {
                          setTimeout(() => {
                            const full = (e.target as HTMLTextAreaElement).value;
                            handleExtractFromJd(full || pasted);
                          }, 50);
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 text-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      placeholder="Paste job description here... (skills and experience will auto-extract immediately)"
                    />

                    {/* Extraction Notice Banner */}
                    {extractionNotice && (
                      <div className="mt-1.5 flex items-center justify-between rounded-md border border-violet-200 bg-violet-50/90 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                          {extractionNotice}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExtractionNotice(null)}
                          className="text-violet-400 hover:text-violet-600 text-[10px] ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Minimum Experience */}
                  <div>
                    <Label htmlFor="min-exp" className="text-xs font-semibold">
                      Minimum Experience Required: <span className="text-violet-600 font-bold">{minExperienceYears} {minExperienceYears === 1 ? 'Year' : 'Years'}</span>
                    </Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      {[0, 1, 2, 3, 5].map((yrs) => (
                        <button
                          key={yrs}
                          type="button"
                          onClick={() => setMinExperienceYears(yrs)}
                          className={`flex-1 rounded-lg border py-1 text-xs font-bold transition-all ${
                            minExperienceYears === yrs
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {yrs === 0 ? 'Fresher' : `${yrs} yr${yrs > 1 ? 's' : ''}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Must-Have Skills */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Must-Have Skills <span className="text-xs font-normal text-muted-foreground">(70% of MS)</span>
                      </Label>
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded">
                        {mustHaveSkills.length} Skills
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {mustHaveSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeMustHaveSkill(skill)}
                            className="hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Input
                        value={newMustHave}
                        onChange={(e) => setNewMustHave(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMustHaveSkill())}
                        placeholder="Add required skill (e.g. Next.js)..."
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMustHaveSkill}
                        className="h-8 px-2.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Nice-To-Have Skills */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-foreground">
                        Nice-To-Have Skills <span className="text-xs font-normal text-muted-foreground">(30% of MS)</span>
                      </Label>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {niceToHaveSkills.length} Skills
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {niceToHaveSkills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeNiceToHaveSkill(skill)}
                            className="hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <Input
                        value={newNiceToHave}
                        onChange={(e) => setNewNiceToHave(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNiceToHaveSkill())}
                        placeholder="Add bonus skill (e.g. Docker)..."
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addNiceToHaveSkill}
                        className="h-8 px-2.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>

            {/* Card 2: Candidate Resume Document */}
            <Card className="border-border shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">2. Candidate Resume Document</CardTitle>
                    {resumeInputType === 'sheet' && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 border border-emerald-300">
                        Sheet Sync Ready
                      </span>
                    )}
                  </div>
                  <CardDescription>
                    Provide Google Drive PDF URL, paste raw resume text, or link a live Google Sheet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Source Toggle: 3 modes */}
                  <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setResumeInputType('text')}
                      className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all ${
                        resumeInputType === 'text'
                          ? 'bg-card text-foreground shadow-xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" /> Raw Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeInputType('drive')}
                      className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all ${
                        resumeInputType === 'drive'
                          ? 'bg-card text-foreground shadow-xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <LinkIcon className="h-3.5 w-3.5" /> Drive Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeInputType('sheet')}
                      className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all ${
                        resumeInputType === 'sheet'
                          ? 'bg-card text-foreground shadow-xs font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Google Sheet
                    </button>
                  </div>

                  {/* Mode 1: Google Sheet */}
                  {resumeInputType === 'sheet' ? (
                    <div className="space-y-3">
                      {/* Sub-toggle: Link vs Direct Paste */}
                      <div className="flex rounded-lg border border-border bg-muted/50 p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setSheetInputMode('url')}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all text-xs font-semibold ${
                            sheetInputMode === 'url'
                              ? 'bg-card text-foreground shadow-xs font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <LinkIcon className="h-3.5 w-3.5" /> Google Sheet Link
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheetInputMode('paste')}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all text-xs font-semibold ${
                            sheetInputMode === 'paste'
                              ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <ClipboardPaste className="h-3.5 w-3.5 text-emerald-600" /> Direct Paste (Ctrl+C &amp; Ctrl+V)
                        </button>
                      </div>

                      {sheetInputMode === 'url' ? (
                        <div className="space-y-2.5">
                          <div>
                            <Label htmlFor="sheet-url" className="text-xs font-semibold flex items-center gap-1.5">
                              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Google Sheet Link
                            </Label>
                            <div className="mt-1 flex gap-1.5">
                              <Input
                                id="sheet-url"
                                value={sheetUrl}
                                onChange={(e) => {
                                  setSheetUrl(e.target.value);
                                  if (sheetError) setSheetError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleFetchSheetCandidates(sheetUrl);
                                  }
                                }}
                                placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                                className="h-9 text-xs font-mono"
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={isFetchingSheet}
                                onClick={() => handleFetchSheetCandidates(sheetUrl)}
                                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 shrink-0 shadow-xs"
                              >
                                {isFetchingSheet ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Load Sheet
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Permission Error Banner */}
                          {sheetError ? (
                            <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 space-y-2">
                              <div className="flex items-start gap-2">
                                <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="font-bold text-amber-900 dark:text-amber-200">
                                    Google Sheet Access Restricted (Google 401: Unauthorized)
                                  </p>
                                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                                    Your Google Sheet is currently <span className="font-bold underline">Restricted</span>, preventing external applications from reading it.
                                  </p>
                                  <div className="mt-1.5 rounded bg-white/70 dark:bg-black/30 p-2 text-[11px] font-medium space-y-1">
                                    <p className="font-bold text-amber-950 dark:text-amber-100">How to fix in 1 minute:</p>
                                    <p>1. Open your Google Sheet and click the <strong>&quot;Share&quot;</strong> button at top right.</p>
                                    <p>2. Under <strong>General access</strong>, select <strong>&quot;Anyone with the link&quot;</strong> (Viewer or Editor).</p>
                                    <p>3. Return here and click the <strong>&quot;Load Sheet&quot;</strong> button.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="pt-1 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                                <span className="text-[10px] text-amber-800 dark:text-amber-400">If changing permissions is inconvenient:</span>
                                <button
                                  type="button"
                                  onClick={() => setSheetInputMode('paste')}
                                  className="inline-flex items-center gap-1 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-900 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 text-[11px] font-bold transition-colors"
                                >
                                  <ClipboardPaste className="h-3 w-3" />
                                  Copy & Paste Rows Directly &rarr;
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Access Note */
                            <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-2.5 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 space-y-1.5">
                              {googleOAuthConnected ? (
                                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                                  <span>Google Account Connected ({googleOAuthEmail}) — Results will update automatically directly in your sheet!</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-300">
                                    <span className="flex items-center gap-1.5">
                                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                                      How to enable direct auto-updates to Google Sheet:
                                    </span>
                                    <a
                                      href="/api/google/oauth/connect?purpose=sheets&return_to=/tools/resume-screening"
                                      className="inline-flex items-center gap-1 rounded bg-violet-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-violet-700 shadow-xs"
                                    >
                                      🔗 Connect Google
                                    </a>
                                  </div>
                                  <div className="text-[11px] leading-relaxed text-emerald-900/90 dark:text-emerald-200/90 pl-5 space-y-0.5">
                                    <p>1. Click <strong>&quot;Connect Google&quot;</strong> above for 1-click permission to write to your Google Sheet.</p>
                                    <p>2. Or in Google Sheet <strong>&quot;Share&quot;</strong> settings, choose General access <strong>&quot;Anyone with the link&quot;</strong> and role <strong>&quot;Editor&quot;</strong>.</p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Direct Paste Sub-mode */
                        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <ClipboardPaste className="h-3.5 w-3.5 text-emerald-600" /> Paste Rows from Google Sheet
                            </Label>
                            <button
                              type="button"
                              onClick={() => {
                                const sampleTsv = `Candidate Name\tBatch\tResume Link\nTanvir Ahmed\tBatch 10 - Web\thttps://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view\nRashedul Islam\tBatch 10 - Web\thttps://drive.google.com/file/d/2B3C4D5E6F7G8H9I0J1K/view\nFarhana Sultana\tBatch 10 - Web\thttps://drive.google.com/file/d/3C4D5E6F7G8H9I0J1K2L/view\nMahmudul Hasan\tBatch 9 - App Dev\thttps://drive.google.com/file/d/4D5E6F7G8H9I0J1K2L3M/view`;
                                setPastedSheetContent(sampleTsv);
                              }}
                              className="text-[10px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                            >
                              Load Example Format
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            In your Google Sheet press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] border">Ctrl + A</kbd> and <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] border">Ctrl + C</kbd>, then paste here:
                          </p>
                          <textarea
                            rows={3}
                            value={pastedSheetContent}
                            onChange={(e) => setPastedSheetContent(e.target.value)}
                            placeholder="Candidate Name&#9;Batch&#9;Resume Link&#10;Tanvir Ahmed&#9;Batch 10&#9;https://drive.google.com/..."
                            className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleParsePastedSheetData}
                            className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Import Pasted Candidates ({pastedSheetContent ? parseCsvToRows(pastedSheetContent).length : 0} rows detected)
                          </Button>
                        </div>
                      )}

                      {/* Sheet Candidates Preview */}
                      <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-violet-600" /> Detected Candidates ({sheetCandidates.length})
                          </span>
                          <div className="flex items-center gap-2">
                            {sheetCandidates.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSheetCandidates([])}
                                className="text-[10px] text-muted-foreground hover:text-red-500 font-semibold"
                              >
                                Clear
                              </button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isFetchingSheet}
                              onClick={() => handleFetchSheetCandidates(sheetUrl)}
                              className="h-6 text-[10px] font-bold px-2 text-violet-600"
                            >
                              {isFetchingSheet ? (
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-1" />
                              )}
                              Refresh
                            </Button>
                          </div>
                        </div>

                        {sheetCandidates.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground bg-card/50 rounded border border-dashed border-border p-3">
                            <p className="font-semibold text-foreground">No Candidates Found</p>
                            <p className="text-[11px] mt-0.5 text-muted-foreground">
                              Enter Google Sheet URL above and click <span className="font-bold text-emerald-600">Load Sheet</span>, or paste rows using <span className="font-bold text-emerald-600">Direct Paste</span>.
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                            {sheetCandidates.map((c) => (
                              <div
                                key={c.rowNumber}
                                className="flex items-center justify-between rounded bg-card p-1.5 text-[11px] border border-border"
                              >
                                <div className="min-w-0 truncate">
                                  <span className="font-bold text-foreground mr-1.5">
                                    #{c.rowNumber} {c.name}
                                  </span>
                                  <span className="text-muted-foreground text-[10px]">({c.batch})</span>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[130px]">
                                  {c.resumeLink ? 'Resume Link' : 'No Link'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : resumeInputType === 'drive' ? (
                    /* Mode 2: Google Drive PDF Link */
                    <div className="space-y-2">
                      <Label htmlFor="drive-url" className="text-xs font-semibold">
                        Google Drive PDF Link
                      </Label>
                      <Input
                        id="drive-url"
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/file/d/..."
                        className="h-9 text-xs"
                      />
                      <div className="flex items-center justify-between pt-0.5">
                        <p className="text-[11px] text-muted-foreground">
                          * Link must be public or shared with &quot;Anyone with the link can view&quot;.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isFetchingDrivePdf}
                          onClick={handleFetchSingleDrivePdf}
                          className="h-7 text-[10px] font-bold text-violet-600 border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 gap-1"
                        >
                          {isFetchingDrivePdf ? (
                            <Sparkles className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          Fetch PDF Text (Read PDF)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Mode 3: Raw Resume Plain Text */
                    <div>
                      <Label htmlFor="resume-text" className="text-xs font-semibold">
                        Resume Plain Text / Content
                      </Label>
                      <textarea
                        id="resume-text"
                        rows={13}
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background p-2.5 font-mono text-[11px] focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        placeholder="Paste candidate resume text here..."
                      />
                    </div>
                  )}
                </CardContent>
              </div>

              {/* Action Button at bottom of Card 2 */}
              <div className="p-6 pt-0">
                {resumeInputType === 'sheet' ? (
                  <Button
                    onClick={handleScreenSheetResumes}
                    disabled={isScreeningSheet}
                    className="w-full bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    {isScreeningSheet ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-spin" /> Screening Sheet & Syncing Feedback...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" /> Run Screening & Sync Feedback to Sheet
                      </span>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleScreenSingle}
                    disabled={isScreening}
                    className="w-full bg-[#6366f1] py-2.5 text-sm font-bold text-white hover:bg-[#4f46e5] shadow-sm"
                  >
                    {isScreening ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-spin" /> Evaluating Resume & ATS Rubric...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <PlayCircle className="h-4 w-4" /> Run AI Resume Screening
                      </span>
                    )}
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Bottom Row: Full Width Comprehensive Screening Report */}
          <div id="screening-result-section" className="space-y-6 pt-2">
            {/* If Google Sheet was screened: show sheet sync overview table */}
            {resumeInputType === 'sheet' && sheetScreened && (
              <div className="space-y-6">
                {/* ======================================================= */}
                {/* COHORT SCREENING INTELLIGENCE & VISUAL ANALYTICS       */}
                {/* ======================================================= */}
                {cohortStats && (
                  <Card className="border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="border-b bg-muted/30 pb-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-100 px-2.5 py-0.5 text-xs font-black text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                              <BarChart2 className="h-3.5 w-3.5" /> Screening Analytics
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              Batch Cohort Performance ({cohortStats.total} Resumes Screened)
                            </span>
                          </div>
                          <CardTitle className="mt-1 text-base font-bold text-foreground">
                            Screening Cohort Visual Analytics &amp; Skill Gap Distribution
                          </CardTitle>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Top Candidate:</span>
                          <span className="inline-flex items-center gap-1 font-bold text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 rounded-full px-2.5 py-0.5">
                            <Trophy className="h-3 w-3 text-amber-600" />
                            {cohortStats.topCandidate?.name || 'N/A'} ({cohortStats.topCandidate?.screeningResult?.finalScore}%)
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 space-y-6">
                      {/* Metric KPI Cards Strip */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {/* Avg Score */}
                        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                          <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                            Avg Score
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-violet-700 dark:text-violet-300">
                              {cohortStats.avgScore}%
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Overall cohort match</p>
                        </div>

                        {/* Good to Go */}
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Good to Go (≥80%)
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                              {cohortStats.goodToGo}
                            </span>
                            <span className="text-xs font-semibold text-emerald-600">
                              ({Math.round((cohortStats.goodToGo / (cohortStats.total || 1)) * 100)}%)
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Interview ready candidates</p>
                        </div>

                        {/* Waiting List */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                            Waiting List (70-79%)
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                              {cohortStats.waitingList}
                            </span>
                            <span className="text-xs font-semibold text-blue-600">
                              ({Math.round((cohortStats.waitingList / (cohortStats.total || 1)) * 100)}%)
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Solid potential fits</p>
                        </div>

                        {/* Partial Fit */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            Partial Fit (50-69%)
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-700 dark:text-amber-300">
                              {cohortStats.partialMatch}
                            </span>
                            <span className="text-xs font-semibold text-amber-600">
                              ({Math.round((cohortStats.partialMatch / (cohortStats.total || 1)) * 100)}%)
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Missing key requirements</p>
                        </div>

                        {/* Critical / Weak */}
                        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/60 dark:bg-red-950/20">
                          <span className="text-[10px] font-black uppercase tracking-wider text-red-700 dark:text-red-300">
                            Weak / Mismatch
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-red-700 dark:text-red-300">
                              {cohortStats.weakFit}
                            </span>
                            <span className="text-xs font-semibold text-red-600">
                              ({Math.round((cohortStats.weakFit / (cohortStats.total || 1)) * 100)}%)
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Below screening threshold</p>
                        </div>

                        {/* Experience Fit */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Experience Fit
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                              {cohortStats.expMeetRate}%
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">Meet {minExperienceYears}+ yrs criteria</p>
                        </div>
                      </div>

                      {/* Visual Stacked Distribution Bar */}
                      <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-emerald-600" /> Cohort Score Distribution Meter
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Good to Go: {cohortStats.goodToGo} • Waiting: {cohortStats.waitingList} • Partial: {cohortStats.partialMatch} • Weak: {cohortStats.weakFit}
                          </span>
                        </div>
                        <div className="h-4 w-full overflow-hidden rounded-full bg-muted flex shadow-inner">
                          {cohortStats.goodToGo > 0 && (
                            <div
                              style={{ width: `${(cohortStats.goodToGo / cohortStats.total) * 100}%` }}
                              className="bg-emerald-500 transition-all duration-500 hover:opacity-90"
                              title={`Good to Go: ${cohortStats.goodToGo} candidates`}
                            />
                          )}
                          {cohortStats.waitingList > 0 && (
                            <div
                              style={{ width: `${(cohortStats.waitingList / cohortStats.total) * 100}%` }}
                              className="bg-blue-500 transition-all duration-500 hover:opacity-90"
                              title={`Waiting List: ${cohortStats.waitingList} candidates`}
                            />
                          )}
                          {cohortStats.partialMatch > 0 && (
                            <div
                              style={{ width: `${(cohortStats.partialMatch / cohortStats.total) * 100}%` }}
                              className="bg-amber-500 transition-all duration-500 hover:opacity-90"
                              title={`Partial Match: ${cohortStats.partialMatch} candidates`}
                            />
                          )}
                          {cohortStats.weakFit > 0 && (
                            <div
                              style={{ width: `${(cohortStats.weakFit / cohortStats.total) * 100}%` }}
                              className="bg-red-500 transition-all duration-500 hover:opacity-90"
                              title={`Weak Fit: ${cohortStats.weakFit} candidates`}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between pt-1 text-[11px] text-muted-foreground font-medium">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Good to Go (≥80%)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Waiting List (70-79%)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Partial Match (50-69%)
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Critical / Weak (&lt;50%)
                            </span>
                          </div>
                          <span>Average ATS Resume Health: {cohortStats.avgAts}%</span>
                        </div>
                      </div>

                      {/* Skills Coverage & Match Rate Frequency Chart */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <BarChart2 className="h-4 w-4 text-violet-600" /> Skill Match Frequency Across Cohort (JD Skill Match Rate)
                          </h4>
                          <span className="text-[11px] text-muted-foreground">
                            % of candidates in sheet having each required skill
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {cohortStats.skillCoverage.map((item) => (
                            <div
                              key={item.skill}
                              className="rounded-lg border border-border bg-card p-2.5 text-xs space-y-1.5 hover:border-violet-300 dark:hover:border-violet-700 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-bold text-foreground truncate">{item.skill}</span>
                                  {item.isMustHave ? (
                                    <span className="rounded bg-violet-100 px-1 py-0.2 text-[9px] font-black text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                                      Must
                                    </span>
                                  ) : (
                                    <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                      Bonus
                                    </span>
                                  )}
                                </div>
                                <span className={`font-mono font-black ${
                                  item.matchRate >= 80
                                    ? 'text-emerald-600'
                                    : item.matchRate >= 60
                                    ? 'text-blue-600'
                                    : item.matchRate >= 40
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                                }`}>
                                  {item.matchRate}%
                                </span>
                              </div>

                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    item.matchRate >= 80
                                      ? 'bg-emerald-500'
                                      : item.matchRate >= 60
                                      ? 'bg-blue-500'
                                      : item.matchRate >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${item.matchRate}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                                <span>{item.matchedCount} of {item.totalCount} candidates matched</span>
                                <span>{item.totalCount - item.matchedCount} missing</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ======================================================= */}
                {/* SORTED CANDIDATE SHEET TABLE                           */}
                {/* ======================================================= */}
                <Card className="border-emerald-200 bg-emerald-50/20 shadow-md dark:border-emerald-900/60 dark:bg-emerald-950/10">
                  <CardHeader className="border-b bg-card/60 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle className="h-3.5 w-3.5" /> Google Sheet Sync Active
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {displayCandidates.length} Candidates Shown (Sorted by Score)
                          </span>
                        </div>
                        <CardTitle className="mt-1.5 text-lg font-black text-foreground">
                          Screening Results &amp; Ranking Leaderboard
                        </CardTitle>
                        {sheetSyncStatus && (
                          <p
                            className={`mt-0.5 text-xs font-semibold ${
                              sheetSyncStatus.startsWith('⚠️')
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {sheetSyncStatus}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          disabled={isSyncingToSheet}
                          onClick={handleSyncToSheetManually}
                          className="h-8 gap-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
                        >
                          {isSyncingToSheet ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" /> Sync to Google Sheet
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyFeedbackToClipboard}
                          className="h-8 gap-1.5 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
                          title="Copy 7 columns and paste into cell K1 in Google Sheet (Ctrl+V)"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy Feedback Columns
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadSheetCsv}
                          className="h-8 gap-1.5 text-xs font-bold"
                        >
                          <Download className="h-3.5 w-3.5" /> Download CSV
                        </Button>
                        <a
                          href={sheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                        >
                          Open Sheet <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>

                    {sheetSyncStatus && sheetSyncStatus.startsWith('⚠️') && (
                      <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold">{sheetSyncStatus}</p>
                          <div className="mt-1 text-[11px] text-amber-950/90 dark:text-amber-200/90 space-y-1">
                            <p>
                              <strong>How to enable auto-updates:</strong> Go to Google Sheet &rarr; Click <strong>&quot;Share&quot;</strong> &rarr; Set General access to <strong>&quot;Anyone with the link&quot;</strong> and role to <strong>&quot;Editor&quot;</strong> &rarr; Click <strong>&quot;Sync to Google Sheet&quot;</strong>.
                            </p>
                            <p className="text-muted-foreground text-[10px]">
                              Backup alternative: Click <strong>&quot;Copy Feedback Columns&quot;</strong> and paste directly into cell K1 via <strong>Ctrl+V</strong>.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Filter and Sort Toolbar */}
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-3">
                      {/* Filter by Bracket */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground font-medium mr-1">Filter:</span>
                        <button
                          type="button"
                          onClick={() => setSheetBracketFilter('all')}
                          className={`rounded-full px-2.5 py-0.5 font-bold transition-all ${
                            sheetBracketFilter === 'all'
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          All ({sheetCandidates.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheetBracketFilter('good-to-go')}
                          className={`rounded-full px-2.5 py-0.5 font-bold transition-all ${
                            sheetBracketFilter === 'good-to-go'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          🟢 Good to Go ({cohortStats?.goodToGo || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheetBracketFilter('waiting-list')}
                          className={`rounded-full px-2.5 py-0.5 font-bold transition-all ${
                            sheetBracketFilter === 'waiting-list'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}
                        >
                          🔵 Waiting List ({cohortStats?.waitingList || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheetBracketFilter('partial-match')}
                          className={`rounded-full px-2.5 py-0.5 font-bold transition-all ${
                            sheetBracketFilter === 'partial-match'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          🟡 Partial ({cohortStats?.partialMatch || 0})
                        </button>
                        {cohortStats && cohortStats.weakFit > 0 && (
                          <button
                            type="button"
                            onClick={() => setSheetBracketFilter('weak-fit')}
                            className={`rounded-full px-2.5 py-0.5 font-bold transition-all ${
                              sheetBracketFilter === 'weak-fit'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
                            }`}
                          >
                            🔴 Weak ({cohortStats.weakFit})
                          </button>
                        )}
                      </div>

                      {/* Sort Controls (Highest to Lowest) */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <ArrowUpDown className="h-3 w-3" /> Sort:
                        </span>
                        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
                          <button
                            type="button"
                            onClick={() => setSheetSortOrder('highest')}
                            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                              sheetSortOrder === 'highest'
                                ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            🏆 Highest Score First
                          </button>
                          <button
                            type="button"
                            onClick={() => setSheetSortOrder('lowest')}
                            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                              sheetSortOrder === 'lowest'
                                ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            📉 Lowest
                          </button>
                          <button
                            type="button"
                            onClick={() => setSheetSortOrder('original')}
                            className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                              sheetSortOrder === 'original'
                                ? 'bg-card text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            📄 Sheet Order
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Rank / Sheet Row</th>
                            <th className="px-4 py-3">Candidate</th>
                            <th className="px-4 py-3">Score &amp; Decision</th>
                            <th className="px-4 py-3">Matched Skills (Matched)</th>
                            <th className="px-4 py-3">Missing / Mismatched (Deficit)</th>
                            <th className="px-4 py-3">Experience</th>
                            <th className="px-4 py-3 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {displayCandidates.map((cand, idx) => {
                            const res = cand.screeningResult;
                            const matchedMustHave =
                              res?.mustHaveEvaluations.filter((s) => s.status !== 'missing') || [];
                            const missingMustHave =
                              res?.mustHaveEvaluations.filter((s) => s.status === 'missing') || [];
                            const meetsExp = res
                              ? res.detectedExperienceYears >= minExperienceYears
                              : false;

                            return (
                              <tr key={`${cand.rowNumber}-${idx}`} className="transition-colors hover:bg-muted/30">
                                {/* Rank & Sheet Row */}
                                <td className="px-4 py-3 font-mono">
                                  <div className="flex items-center gap-2">
                                    {sheetSortOrder === 'highest' && res ? (
                                      <span
                                        className={`inline-flex items-center justify-center font-black rounded-full text-xs px-2 py-0.5 ${
                                          idx === 0
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300'
                                            : idx === 1
                                            ? 'bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-850 dark:text-slate-200'
                                            : idx === 2
                                            ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                      >
                                        {idx === 0
                                          ? '🥇 #1'
                                          : idx === 1
                                          ? '🥈 #2'
                                          : idx === 2
                                          ? '🥉 #3'
                                          : `#${idx + 1}`}
                                      </span>
                                    ) : null}
                                    <span className="text-[11px] text-muted-foreground font-medium">
                                      Row #{cand.rowNumber}
                                    </span>
                                  </div>
                                </td>

                                {/* Candidate Name & Batch */}
                                <td className="px-4 py-3">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-foreground block">
                                        {cand.name}
                                      </span>
                                      {cand.isRealPdf && (
                                        <span className="rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1 py-0.2 dark:bg-emerald-950 dark:text-emerald-300">
                                          PDF
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">{cand.batch}</span>
                                      {cand.resumeLink && (
                                        <a
                                          href={cand.resumeLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 text-[10px] font-mono text-violet-600 hover:underline"
                                        >
                                          <LinkIcon className="h-2.5 w-2.5" /> File
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Score & Decision */}
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <span className="text-base font-black text-foreground">
                                      {cand.existingScore || '—'}
                                    </span>
                                    {res?.decision ? (
                                      <div>
                                        <span
                                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${res.decision.badgeClass}`}
                                        >
                                          {cand.existingDecision}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </td>

                                {/* Matched Skills */}
                                <td className="px-4 py-3 max-w-[240px]">
                                  {res ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1">
                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                          <Check className="h-2.5 w-2.5" />
                                          {matchedMustHave.length} / {mustHaveSkills.length} Matched
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {matchedMustHave.slice(0, 3).map((s) => (
                                          <span
                                            key={s.skill}
                                            className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                          >
                                            ✓ {s.skill}
                                          </span>
                                        ))}
                                        {matchedMustHave.length > 3 && (
                                          <span className="text-[9px] text-muted-foreground self-center">
                                            +{matchedMustHave.length - 3} more
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-[11px]">—</span>
                                  )}
                                </td>

                                {/* Missing / Mismatched */}
                                <td className="px-4 py-3 max-w-[220px]">
                                  {res ? (
                                    missingMustHave.length === 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <Check className="h-3 w-3" /> No Missing Skills
                                      </span>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1">
                                          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                                            <X className="h-2.5 w-2.5" />
                                            {missingMustHave.length} Missing
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {missingMustHave.slice(0, 3).map((s) => (
                                            <span
                                              key={s.skill}
                                              className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                                            >
                                              ✕ {s.skill}
                                            </span>
                                          ))}
                                          {missingMustHave.length > 3 && (
                                            <span className="text-[9px] text-muted-foreground self-center">
                                              +{missingMustHave.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground text-[11px]">—</span>
                                  )}
                                </td>

                                {/* Experience */}
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {res ? (
                                    meetsExp ? (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <Check className="h-3 w-3" /> {res.detectedExperienceYears} Yrs
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                        title={`Needs ${minExperienceYears} years`}
                                      >
                                        <AlertCircle className="h-3 w-3" /> {res.detectedExperienceYears} Yrs (Req{' '}
                                        {minExperienceYears})
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>

                                {/* Action / Inspect */}
                                <td className="px-4 py-3 text-right">
                                  {cand.screeningResult ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleInspectReport(cand.screeningResult!, cand.name, cand.batch, cand)
                                      }
                                      className="inline-flex items-center gap-1 font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline"
                                    >
                                      Inspect Report →
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const resumeContent = getResumeTextForLink(
                                          cand.name,
                                          cand.resumeLink,
                                          cand.rowNumber,
                                        );
                                        const evalResult = runResumeScreening({
                                          candidateName: cand.name,
                                          batch: cand.batch,
                                          jobDescription,
                                          resumeInput: resumeContent,
                                          mustHaveSkills,
                                          niceToHaveSkills,
                                          minExperienceYears,
                                        });
                                        cand.screeningResult = evalResult;
                                        cand.existingScore = `${evalResult.finalScore}%`;
                                        cand.existingDecision = evalResult.decision.label;
                                        cand.existingFeedback = generateFeedbackText(evalResult);
                                        setSheetCandidates([...sheetCandidates]);
                                        handleInspectReport(evalResult, cand.name, cand.batch, cand);
                                      }}
                                      className="inline-flex items-center gap-1 font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline"
                                    >
                                      Inspect Report →
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Individual Detailed Visual Report */}
            {result ? (
              <div id="individual-detailed-report" className="space-y-5 animate-in fade-in-50 duration-300 scroll-mt-6">
                {/* Hero Decision Card */}
                <Card className={`border-2 ${result.decision.borderClass} ${result.decision.bgClass} shadow-md`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${result.decision.badgeClass}`}>
                            <Award className="h-3.5 w-3.5" />
                            {result.decision.label}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {result.candidateName} • {result.batch}
                          </span>
                        </div>
                        <h2 className="mt-2 text-xl font-black text-foreground">
                          {result.decision.description}
                        </h2>
                      </div>

                      {/* Final Score Circle */}
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 shadow-sm min-w-[120px]">
                        <span className={`text-4xl font-black ${result.decision.textClass}`}>
                          {result.finalScore}%
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Final Score
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Score Breakdown Cards Grid (4 Cards) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* Must-Have Score */}
                  <Card className="border-border p-3.5 shadow-xs">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Must-Have (MHS)
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{result.mustHaveScore}%</span>
                      <span className="text-[10px] text-muted-foreground">/ 70% wt</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-violet-600 rounded-full"
                        style={{ width: `${result.mustHaveScore}%` }}
                      />
                    </div>
                  </Card>

                  {/* Nice-To-Have Score */}
                  <Card className="border-border p-3.5 shadow-xs">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Nice-To-Have (NTHS)
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{result.niceToHaveScore}%</span>
                      <span className="text-[10px] text-muted-foreground">/ 30% wt</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${result.niceToHaveScore}%` }}
                      />
                    </div>
                  </Card>

                  {/* ATS Structure Score */}
                  <Card className="border-border p-3.5 shadow-xs">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      ATS Structure
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{result.atsScore}%</span>
                      <span className="text-[10px] text-muted-foreground">/ 20% wt</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${result.atsScore}%` }}
                      />
                    </div>
                  </Card>

                  {/* Penalties Deductions */}
                  <Card className="border-border p-3.5 shadow-xs">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Penalties
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${result.penalties.totalDeduction > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {result.penalties.totalDeduction > 0 ? `-${result.penalties.totalDeduction}%` : '0%'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">deducted</span>
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground truncate">
                      {result.penalties.totalDeduction > 0 ? 'Missing / Unrelated' : 'No deductions'}
                    </div>
                  </Card>
                </div>

                {/* Skills Evaluation Row (Side by side 2 columns) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Must-Have Skills Matching Detailed Breakdown */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-2.5">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-violet-600" /> Must-Have Technical Skills Evaluation
                        </CardTitle>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Earned: {result.mustHaveScore}%
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {result.mustHaveEvaluations.map((item) => (
                          <div
                            key={item.skill}
                            className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs transition-colors hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {item.status === 'strong' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : item.status === 'moderate' ? (
                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                              )}
                              <div className="truncate">
                                <span className="font-bold text-foreground">{item.skill}</span>
                                {item.matchedKeyword && (
                                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                                    (Matched: &quot;{item.matchedKeyword}&quot;)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none ${
                                  item.status === 'strong'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : item.status === 'moderate'
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                }`}
                              >
                                {item.status === 'strong'
                                  ? 'Strong Match (1.0)'
                                  : item.status === 'moderate'
                                    ? 'Moderate Match (0.6)'
                                    : 'Missing (0.0)'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Nice-To-Have Skills Breakdown */}
                  <Card className="border-border shadow-xs">
                    <CardHeader className="pb-2.5">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Layers className="h-4 w-4 text-indigo-500" /> Nice-To-Have Skills Evaluation
                        </CardTitle>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Earned: {result.niceToHaveScore}%
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {result.niceToHaveEvaluations.length > 0 ? (
                        <div className="space-y-2">
                          {result.niceToHaveEvaluations.map((item) => (
                            <div
                              key={item.skill}
                              className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs transition-colors hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {item.status === 'strong' ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                ) : item.status === 'moderate' ? (
                                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="font-semibold text-foreground truncate">{item.skill}</span>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  item.status === 'strong'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50'
                                    : item.status === 'moderate'
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50'
                                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                }`}
                              >
                                {item.status === 'strong'
                                  ? '+1.0'
                                  : item.status === 'moderate'
                                    ? '+0.6'
                                    : '0.0'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          No Nice-to-Have skills defined for this job.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Experience & Penalties Audit Card (Side by side 2 columns) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Experience Detector Result */}
                  <Card className="border-border p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-violet-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Experience Audit
                      </h4>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-foreground">
                          {result.detectedExperienceYears} Years
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (Required: {minExperienceYears} yrs)
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {result.experienceSummary}
                      </p>
                      <div className="mt-2.5">
                        {result.penalties.experienceGap.meetsRequirement ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Check className="h-3 w-3" /> Meets Minimum Experience Criteria
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            <AlertCircle className="h-3 w-3" /> Experience falls below job requirement
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Irrelevant / Extra Skills & Deductions */}
                  <Card className="border-border p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Unrelated Skills & Penalties
                      </h4>
                    </div>
                    <div className="mt-3">
                      {result.unrelatedSkillsDetected.length > 0 ? (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Detected non-relevant tech stack outside JD:
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {result.unrelatedSkillsDetected.map((sk) => (
                              <Badge key={sk} variant="outline" className="border-red-200 text-red-600 dark:border-red-900 text-[10px]">
                                {sk}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-[11px] font-semibold text-red-600 dark:text-red-400">
                            Penalty: -{result.penalties.unrelatedSkills.deduction}% (2% per 2 extra skills)
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                          ✓ No irrelevant or conflicting skills detected in resume.
                        </p>
                      )}

                      {result.penalties.criticalMissing.count > 0 && (
                        <p className="mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">
                          Critical Missing Penalty: -10% applied ({result.penalties.criticalMissing.skills.join(', ')})
                        </p>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BATCH SCREENING TAB                                            */}
      {/* ============================================================== */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          {/* Batch Controls Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Batch Screening Workspace ({batchCandidates.length} Candidates)
              </h2>
              <p className="text-xs text-muted-foreground">
                Screen candidate cohorts simultaneously against active JD requirements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleRunBatchScreening}
                disabled={isBatchScreening}
                className="bg-violet-600 font-bold hover:bg-violet-700"
              >
                {isBatchScreening ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-spin" /> Batch Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4" /> Screen All Candidates
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Batch Stats Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Cohort</span>
              <p className="text-xl font-black text-foreground">{totalBatch}</p>
            </Card>
            <Card className="p-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Evaluated</span>
              <p className="text-xl font-black text-violet-600">{screenedBatch.length} / {totalBatch}</p>
            </Card>
            <Card className="p-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Good To Go (≥80%)</span>
              <p className="text-xl font-black text-emerald-600">{goodToGoCount}</p>
            </Card>
            <Card className="p-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Waiting List</span>
              <p className="text-xl font-black text-blue-600">{waitingListCount}</p>
            </Card>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-muted-foreground mr-1">Filter Decision:</span>
            {[
              { id: 'all', label: 'All Candidates' },
              { id: 'good-to-go', label: 'Good to Go (≥80%)' },
              { id: 'waiting-list', label: 'Waiting List (70-79%)' },
              { id: 'partial-match', label: 'Partial Match (50-69%)' },
              { id: 'weak-fit', label: 'Weak Fit (30-49%)' },
              { id: 'critical-mismatch', label: 'Critical Mismatch (<30%)' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBatchFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  batchFilter === f.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Batch Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Must-Have (MHS)</th>
                    <th className="px-4 py-3">Nice-To-Have</th>
                    <th className="px-4 py-3">ATS Score</th>
                    <th className="px-4 py-3">Final Score</th>
                    <th className="px-4 py-3">Decision</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 font-bold text-foreground">
                        {candidate.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {candidate.batch}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.result ? (
                          <span className="font-semibold text-foreground">{candidate.result.mustHaveScore}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.result ? (
                          <span className="font-semibold text-foreground">{candidate.result.niceToHaveScore}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.result ? (
                          <span className="font-semibold text-foreground">{candidate.result.atsScore}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.result ? (
                          <span className="text-sm font-black text-foreground">{candidate.result.finalScore}%</span>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Pending</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.result ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${candidate.result.decision.badgeClass}`}>
                            {candidate.result.decision.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {candidate.result ? (
                          <button
                            type="button"
                            onClick={() => handleInspectReport(candidate.result!, candidate.name, candidate.batch)}
                            className="inline-flex items-center gap-1 font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline"
                          >
                            Inspect Report <ArrowRight className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const r = runResumeScreening({
                                candidateName: candidate.name,
                                batch: candidate.batch,
                                jobDescription,
                                resumeInput: candidate.resumeInput,
                                mustHaveSkills,
                                niceToHaveSkills,
                                minExperienceYears,
                              });
                              setBatchCandidates((prev) =>
                                prev.map((item) =>
                                  item.id === candidate.id
                                    ? { ...item, status: 'completed', result: r }
                                    : item,
                                ),
                              );
                              toast.success(`Screened ${candidate.name}`);
                            }}
                            className="font-semibold text-violet-600 hover:underline"
                          >
                            Screen Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* INTERACTIVE CANDIDATE INSPECTION MODAL                         */}
      {/* ============================================================== */}
      {isReportModalOpen && (inspectedCandidate || result) && (() => {
        const modalResult = (inspectedCandidate || result)!;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
            onClick={() => setIsReportModalOpen(false)}
          >
            <div
              className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-5 sm:p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-black uppercase tracking-wider ${modalResult.decision.badgeClass}`}>
                      <Award className="h-3.5 w-3.5" />
                      {modalResult.decision.label}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {modalResult.batch}
                    </span>
                  </div>
                  <h2 className="mt-1 text-2xl font-black text-foreground">
                    {modalResult.candidateName}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1 rounded-xl border border-border bg-muted/40 px-3 py-1.5">
                    <span className={`text-2xl font-black ${modalResult.decision.textClass}`}>
                      {modalResult.finalScore}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Score
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Decision Recommendation Banner */}
              <div className={`rounded-xl border-2 p-4 ${modalResult.decision.borderClass} ${modalResult.decision.bgClass}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Placement Status &amp; Assessment:
                    </span>
                    <h3 className="mt-0.5 text-base font-bold text-foreground">
                      {modalResult.decision.description}
                    </h3>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${modalResult.decision.badgeClass}`}>
                    Bracket: {modalResult.decision.bracket}
                  </span>
                </div>
              </div>

              {/* Match vs Mismatch Quick Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4">
                {/* Matched Column */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-2 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Matched Criteria
                    </span>
                    <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                      {modalResult.mustHaveEvaluations.filter((s) => s.status !== 'missing').length} Skills
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {modalResult.mustHaveEvaluations
                      .filter((s) => s.status !== 'missing')
                      .map((s) => (
                        <span
                          key={s.skill}
                          className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-300 shadow-2xs dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                        >
                          ✓ {s.skill}
                        </span>
                      ))}
                  </div>
                  <div className="pt-1.5 border-t border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-300">
                    Experience: <strong>{modalResult.detectedExperienceYears} Years</strong>{' '}
                    {modalResult.penalties.experienceGap.meetsRequirement
                      ? '(✓ Meets requirement)'
                      : `(⚠️ Job requires ${minExperienceYears} years)`}
                  </div>
                </div>

                {/* Mismatched Column */}
                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 space-y-2 dark:border-red-900/60 dark:bg-red-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Mismatched / Missing Criteria
                    </span>
                    <span className="rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-black text-red-900 dark:bg-red-900 dark:text-red-200">
                      {modalResult.mustHaveEvaluations.filter((s) => s.status === 'missing').length} Missing
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {modalResult.mustHaveEvaluations.filter((s) => s.status === 'missing').length > 0 ? (
                      modalResult.mustHaveEvaluations
                        .filter((s) => s.status === 'missing')
                        .map((s) => (
                          <span
                            key={s.skill}
                            className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-red-800 border border-red-300 shadow-2xs dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                          >
                            ✕ {s.skill}
                          </span>
                        ))
                    ) : (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                        ✓ No critical skill gaps! All Must-Have skills found.
                      </span>
                    )}
                  </div>
                  <div className="pt-1.5 border-t border-red-200 dark:border-red-900 text-[11px] text-red-800 dark:text-red-300">
                    {!modalResult.penalties.experienceGap.meetsRequirement ? (
                      <span className="text-amber-800 dark:text-amber-300 font-semibold">
                        ⚠️ Work experience: {modalResult.detectedExperienceYears} years (Job requires: {minExperienceYears} years)
                      </span>
                    ) : (
                      <span>No experience deficit.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Must-Have Score */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Must-Have (MHS)
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-foreground">{modalResult.mustHaveScore}%</span>
                    <span className="text-[10px] text-muted-foreground">/ 70% wt</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-violet-600 rounded-full"
                      style={{ width: `${modalResult.mustHaveScore}%` }}
                    />
                  </div>
                </div>

                {/* Nice-To-Have Score */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Nice-To-Have (NTHS)
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-foreground">{modalResult.niceToHaveScore}%</span>
                    <span className="text-[10px] text-muted-foreground">/ 30% wt</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${modalResult.niceToHaveScore}%` }}
                    />
                  </div>
                </div>

                {/* ATS Structure Score */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    ATS Structure
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-foreground">{modalResult.atsScore}%</span>
                    <span className="text-[10px] text-muted-foreground">/ 20% wt</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${modalResult.atsScore}%` }}
                    />
                  </div>
                </div>

                {/* Penalties Deductions */}
                <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Penalties
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className={`text-2xl font-black ${modalResult.penalties.totalDeduction > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {modalResult.penalties.totalDeduction > 0 ? `-${modalResult.penalties.totalDeduction}%` : '0%'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">deducted</span>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground truncate">
                    {modalResult.penalties.totalDeduction > 0 ? 'Missing / Extra Tech' : 'No deductions'}
                  </div>
                </div>
              </div>

              {/* Skills Evaluation Row (Side by side 2 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Must-Have Skills */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-violet-600" /> Must-Have Technical Skills
                    </h4>
                    <span className="text-xs font-bold text-violet-600">{modalResult.mustHaveScore}%</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {modalResult.mustHaveEvaluations.map((item) => (
                      <div
                        key={item.skill}
                        className="flex items-center justify-between rounded-lg border border-border p-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {item.status === 'strong' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : item.status === 'moderate' ? (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          )}
                          <span className="font-semibold text-foreground truncate">{item.skill}</span>
                          {item.matchedKeyword && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({item.matchedKeyword})
                            </span>
                          )}
                        </div>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.status === 'strong'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : item.status === 'moderate'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {item.status === 'strong' ? '1.0' : item.status === 'moderate' ? '0.6' : '0.0'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nice-To-Have Skills */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-indigo-500" /> Nice-To-Have Skills
                    </h4>
                    <span className="text-xs font-bold text-indigo-600">{modalResult.niceToHaveScore}%</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {modalResult.niceToHaveEvaluations.length > 0 ? (
                      modalResult.niceToHaveEvaluations.map((item) => (
                        <div
                          key={item.skill}
                          className="flex items-center justify-between rounded-lg border border-border p-2 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {item.status === 'strong' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : item.status === 'moderate' ? (
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="font-semibold text-foreground truncate">{item.skill}</span>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              item.status === 'strong'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : item.status === 'moderate'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                            }`}
                          >
                            {item.status === 'strong' ? '+1.0' : item.status === 'moderate' ? '+0.6' : '0.0'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">No Nice-to-Have skills defined</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Experience & Deductions Audit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Experience Audit */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Briefcase className="h-4 w-4 text-violet-600" /> Experience Detection
                  </div>
                  <div className="mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-foreground">
                        {modalResult.detectedExperienceYears} Years
                      </span>
                      <span className="text-xs text-muted-foreground">
                        (Job required: {minExperienceYears} yrs)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {modalResult.experienceSummary}
                    </p>
                    <div className="mt-2">
                      {modalResult.penalties.experienceGap.meetsRequirement ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <Check className="h-3 w-3" /> Meets Minimum Experience Criteria
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          <AlertCircle className="h-3 w-3" /> Experience falls below job requirement
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Irrelevant Skills & Penalties */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <ShieldAlert className="h-4 w-4 text-red-500" /> Penalties &amp; Extra Skills
                  </div>
                  <div className="mt-2 text-xs">
                    {modalResult.unrelatedSkillsDetected.length > 0 ? (
                      <div>
                        <p className="text-muted-foreground">Unrelated Tech detected:</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {modalResult.unrelatedSkillsDetected.map((sk) => (
                            <span key={sk} className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
                              {sk}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1.5 font-bold text-red-600 dark:text-red-400 text-[11px]">
                          Extra skills penalty: -{modalResult.penalties.unrelatedSkills.deduction}%
                        </p>
                      </div>
                    ) : (
                      <p className="text-emerald-600 font-semibold">✓ No extra irrelevant skills</p>
                    )}

                    {modalResult.penalties.criticalMissing.count > 0 && (
                      <p className="mt-2 font-bold text-red-600 dark:text-red-400 text-[11px]">
                        Critical Missing: -10% ({modalResult.penalties.criticalMissing.skills.join(', ')})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Automated Feedback String */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Generated Sheet Feedback:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fb = generateFeedbackText(modalResult);
                      navigator.clipboard.writeText(fb);
                      toast.success('Feedback copied to clipboard!');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copy Feedback
                  </button>
                </div>
                <p className="text-xs font-mono text-muted-foreground bg-card p-2 rounded border border-border leading-relaxed select-all">
                  {generateFeedbackText(modalResult)}
                </p>
              </div>

              {/* Candidate Resume Text & Live Re-screening Box */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-600" />
                    <span className="text-xs font-bold text-foreground">
                      Candidate Resume Content (Resume Text & Custom Editor)
                    </span>
                    {selectedCandidateRow?.isRealPdf && (
                      <span className="rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ Real PDF Parsed
                      </span>
                    )}
                  </div>
                  {selectedCandidateRow?.resumeLink && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isFetchingModalPdf}
                      onClick={handleFetchModalPdf}
                      className="h-7 text-[11px] font-bold text-violet-600 border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300"
                    >
                      {isFetchingModalPdf ? (
                        <Sparkles className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      Fetch PDF from Drive Link
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Optionally edit or paste candidate resume text here to re-screen:
                </p>

                <textarea
                  rows={4}
                  value={candidateModalResumeText}
                  onChange={(e) => setCandidateModalResumeText(e.target.value)}
                  placeholder="Paste or edit candidate's actual resume text here..."
                  className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-relaxed focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {candidateModalResumeText ? `${candidateModalResumeText.length} characters` : 'No text loaded'}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleReScreenModalCandidate}
                    className="h-7.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" /> Re-Screen Candidate (Audit Again)
                  </Button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsReportModalOpen(false);
                    setTimeout(() => {
                      document.getElementById('individual-detailed-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                  }}
                  className="text-xs font-bold text-violet-600 hover:underline inline-flex items-center gap-1"
                >
                  View in Main Page Below &darr;
                </button>

                <Button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="bg-violet-600 hover:bg-violet-700 font-bold text-xs px-5"
                >
                  Close Report
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* LIVE SCREENING PROGRESS OVERLAY (INCREASING COUNTER ANIMATION) */}
      {/* ============================================================== */}
      {isScreeningSheet && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsScreeningSheet(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header with animated radar indicator & Close Button */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                {screeningProgress.percentage === 100 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}
                <h3 className="text-base font-black text-foreground">
                  {screeningProgress.percentage === 100
                    ? 'Screening 100% Complete!'
                    : 'AI Candidate Screening in Progress...'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-mono font-black">
                  {screeningProgress.percentage}%
                </span>
                <button
                  type="button"
                  onClick={() => setIsScreeningSheet(false)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  title="Close Modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Prominent Increasing Counter Display */}
            <div className="text-center py-2 space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
                Evaluating Resumes Against JD Criteria
              </span>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-black text-emerald-600 font-mono tracking-tight animate-in fade-in">
                  {screeningProgress.current}
                </span>
                <span className="text-2xl font-bold text-muted-foreground font-mono">
                  / {screeningProgress.total} Candidates
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Analyzing Must-Have skills, experience duration, and ATS structure
              </p>
            </div>

            {/* Glowing Animated Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden relative shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-violet-600 transition-all duration-150 ease-out rounded-full relative"
                  style={{ width: `${screeningProgress.percentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Currently Evaluating Candidate Card */}
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 animate-spin" />
                <div className="truncate">
                  <span className="text-muted-foreground font-medium mr-1.5">Checking:</span>
                  <span className="font-bold text-foreground">
                    {screeningProgress.currentName || 'Candidate'}
                  </span>
                  <span className="ml-1 text-[10px] text-muted-foreground font-mono">
                    (Row #{screeningProgress.currentRow})
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 shrink-0 dark:bg-emerald-950 dark:text-emerald-300">
                Active
              </span>
            </div>

            {/* Real-time Ticker Statistics */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1">
              <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Good to Go</span>
                <p className="text-lg font-black text-emerald-700 font-mono">{screeningProgress.goodToGo}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Waiting List</span>
                <p className="text-lg font-black text-amber-700 font-mono">{screeningProgress.waitingList}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                <span className="text-[10px] font-bold text-red-700 uppercase">Weak / Review</span>
                <p className="text-lg font-black text-red-700 font-mono">{screeningProgress.needReview}</p>
              </div>
              <div className="rounded-lg bg-violet-50 p-2 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900">
                <span className="text-[10px] font-bold text-violet-700 uppercase">Avg Score</span>
                <p className="text-lg font-black text-violet-700 font-mono">{screeningProgress.avgScore}%</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
