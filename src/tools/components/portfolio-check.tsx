'use client';

import React, { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  Copy,
  RefreshCw,
  PlayCircle,
  Layers,
  Lock,
  X,
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Award,
  ShieldCheck,
  Code,
  Layout,
  Terminal,
  FileCode,
  Smartphone,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PortfolioEvaluationResult,
  PortfolioCriterionResult,
  validatePortfolioUrl,
} from '@/tools/operations/portfolio-check/portfolio-evaluator';
import { PortfolioCandidateRow } from '@/app/api/tools/portfolio-check/sheet/route';
import { logRealToolUsage } from '@/lib/tools-usage/client';

export function PortfolioCheckTool() {
  // Mode selection: Single vs Google Sheet
  const [activeTab, setActiveTab] = useState<'single' | 'sheet'>('single');

  // Single Profile State
  const [studentName, setStudentName] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [showHtmlPaste, setShowHtmlPaste] = useState(false);
  const [isSingleAuditing, setIsSingleAuditing] = useState(false);
  const [singleResult, setSingleResult] = useState<PortfolioEvaluationResult | null>(null);

  // Google Sheet Mode State
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetCandidates, setSheetCandidates] = useState<PortfolioCandidateRow[]>([]);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isScreeningSheet, setIsScreeningSheet] = useState(false);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<string>('');
  const [sheetFilter, setSheetFilter] = useState<string>('all');
  const [sheetSortOrder, setSheetSortOrder] = useState<'highest' | 'lowest' | 'original'>('highest');
  const [inspectedCandidate, setInspectedCandidate] = useState<PortfolioCandidateRow | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Live Counter Progress Modal State
  const [screeningProgress, setScreeningProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    currentName: '',
    currentRow: 0,
    outstandingCount: 0,
    strongCount: 0,
    moderateCount: 0,
    needsWorkCount: 0,
    avgScore: 0,
  });

  // Check Google OAuth status
  useEffect(() => {
    fetch('/api/google/oauth/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.canManageSheets) {
          setGoogleConnected(true);
          setGoogleEmail(data.email);
        }
      })
      .catch(() => {});
  }, []);

  // -------------------------------------------------------------
  // SINGLE PORTFOLIO AUDIT
  // -------------------------------------------------------------
  const handleSingleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portfolioUrl.trim() && !pastedHtml.trim()) {
      toast.error('Please provide a live portfolio link or page source.');
      return;
    }

    // Check Auth Wall or Dashboard
    if (portfolioUrl.trim()) {
      const validation = validatePortfolioUrl(portfolioUrl.trim());
      if (!validation.isValid) {
        toast.error(validation.reason || 'Invalid portfolio link detected.');
      }
    }

    setIsSingleAuditing(true);
    try {
      const res = await fetch('/api/tools/portfolio-check/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: portfolioUrl.trim(),
          pastedHtml: pastedHtml.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Failed to audit portfolio.');
        return;
      }

      setSingleResult(data.result);

      if (data.result.isBlockedByAuthOrDashboard) {
        toast.error('Invalid dashboard link! Score: 0/60');
      } else if (data.result.isCloudflareBlocked) {
        toast.warning('Cloudflare Challenge detected! Paste page source HTML below using Ctrl+U.');
        setShowHtmlPaste(true);
      } else {
        toast.success(`Portfolio audit complete! Score: ${data.result.totalScore}/60 (${data.result.grade})`);
      }

      logRealToolUsage({
        toolId: 'portfolio-check',
        toolName: 'Portfolio Check (60 Marks)',
        actionType: 'single_audit',
        candidateCount: 1,
      });
    } catch {
      toast.error('Failed to audit portfolio.');
    } finally {
      setIsSingleAuditing(false);
    }
  };

  // -------------------------------------------------------------
  // GOOGLE SHEET: FETCH CANDIDATES
  // -------------------------------------------------------------
  const handleFetchSheet = async () => {
    if (!sheetUrl.trim()) {
      toast.error('Please enter a Google Sheet URL.');
      return;
    }
    setIsFetchingSheet(true);
    setSheetSyncStatus('');
    try {
      const res = await fetch('/api/tools/portfolio-check/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl, action: 'fetch' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Could not load data from sheet.');
        return;
      }
      setSheetCandidates(data.candidates || []);
      toast.success(`Successfully loaded ${data.candidates.length} candidate(s) from sheet!`);
    } catch {
      toast.error('Failed to load Google Sheet.');
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // -------------------------------------------------------------
  // GOOGLE SHEET: RUN BATCH AUDIT & AUTO UPDATE SHEET
  // -------------------------------------------------------------
  const handleRunSheetAudit = async () => {
    if (sheetCandidates.length === 0) {
      toast.error('No candidates found. Please click Load Sheet first.');
      return;
    }

    setIsScreeningSheet(true);
    const total = sheetCandidates.length;

    let outstanding = 0;
    let strong = 0;
    let moderate = 0;
    let needsWork = 0;
    let scoreSum = 0;
    const auditedRows: PortfolioCandidateRow[] = new Array(total);
    let completedCount = 0;

    setScreeningProgress({
      current: 0,
      total,
      percentage: 0,
      currentName: 'Starting live portfolio audit...',
      currentRow: 1,
      outstandingCount: 0,
      strongCount: 0,
      moderateCount: 0,
      needsWorkCount: 0,
      avgScore: 0,
    });

    setSheetSyncStatus('Auditing candidate portfolios live...');

    // Controlled concurrency of 3 parallel workers
    const concurrency = 3;
    let taskIndex = 0;

    const worker = async () => {
      while (taskIndex < total) {
        const i = taskIndex++;
        const cand = sheetCandidates[i];
        const targetUrl = (cand.portfolioUrl || cand.resumeLink || '').trim();

        let evaluation: PortfolioEvaluationResult | undefined;
        let score = 0;
        let grade: PortfolioCandidateRow['portfolioGrade'] = 'Needs Improvement';
        let feedback = 'No portfolio link provided.';

        if (targetUrl && targetUrl.length >= 5) {
          try {
            const res = await fetch('/api/tools/portfolio-check/audit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: targetUrl }),
            });
            const data = await res.json();
            if (res.ok && data.success && data.result) {
              const resEval = data.result as PortfolioEvaluationResult;
              evaluation = resEval;
              score = resEval.totalScore;
              grade = resEval.grade;
              feedback = (resEval.recommendations || []).join(' • ');
            }
          } catch {
            feedback = 'Could not fetch portfolio site.';
          }
        }

        scoreSum += score;
        if (score >= 50) outstanding++;
        else if (score >= 40) strong++;
        else if (score >= 30) moderate++;
        else needsWork++;

        completedCount++;
        const currentAvg = Math.round(scoreSum / completedCount);
        const currentPct = Math.round((completedCount / total) * 98);

        auditedRows[i] = {
          ...cand,
          portfolioUrl: targetUrl,
          portfolioResult: evaluation,
          portfolioScore: score,
          portfolioScorePercentage: Math.round((score / 60) * 100),
          portfolioGrade: grade,
          portfolioFeedback: feedback,
          syncStatus: 'audited',
        };

        // Live scorecard update for each candidate
        setScreeningProgress({
          current: completedCount,
          total,
          percentage: currentPct,
          currentName: cand.name,
          currentRow: cand.rowNumber,
          outstandingCount: outstanding,
          strongCount: strong,
          moderateCount: moderate,
          needsWorkCount: needsWork,
          avgScore: currentAvg,
        });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));

      const finalAvg = Math.round(scoreSum / total);
      setScreeningProgress({
        current: total,
        total,
        percentage: 100,
        currentName: 'Completed Audit — Writing to Google Sheet...',
        currentRow: total + 1,
        outstandingCount: outstanding,
        strongCount: strong,
        moderateCount: moderate,
        needsWorkCount: needsWork,
        avgScore: finalAvg,
      });

      setSheetCandidates(auditedRows);
      setSheetSortOrder('highest');

      await new Promise((r) => setTimeout(r, 400));
      setIsScreeningSheet(false);

      toast.success(`Portfolio audit complete for all ${total} candidates!`);
      logRealToolUsage({
        toolId: 'portfolio-check',
        toolName: 'Portfolio Check (60 Marks)',
        actionType: 'batch_audit',
        candidateCount: total,
      });
      setSheetSyncStatus('Updating scores and columns in Google Sheet...');

      // Atomic Google Sheet update
      const syncRes = await fetch('/api/tools/portfolio-check/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl,
          action: 'audit',
          candidates: auditedRows,
        }),
      });

      const syncData = await syncRes.json();
      if (syncData.syncedToSheet) {
        setSheetSyncStatus('✓ Results and grades automatically updated and sorted in Google Sheet.');
        toast.success(`Successfully audited ${total} candidates; Google Sheet auto-updated!`);
      } else {
        const err = syncData.syncError || 'Could not directly update Google Sheet.';
        setSheetSyncStatus(`⚠️ ${err}`);
        toast.warning(err, { duration: 9000 });
      }
    } catch {
      setIsScreeningSheet(false);
      setSheetSyncStatus('⚠️ Failed to process batch audit.');
      toast.error('Audit encountered an unexpected error.');
    }
  };

  // Helper for Grade Styling
  const getGradeBadge = (grade?: string, score?: number) => {
    const sc = score ?? 0;
    if (sc >= 50 || grade === 'Outstanding Portfolio') {
      return (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-2.5 py-0.5">
          <Award className="h-3 w-3 mr-1" /> Outstanding ({sc}/60)
        </Badge>
      );
    }
    if (sc >= 40 || grade === 'Strong Portfolio') {
      return (
        <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-2.5 py-0.5">
          <ShieldCheck className="h-3 w-3 mr-1" /> Strong ({sc}/60)
        </Badge>
      );
    }
    if (sc >= 30 || grade === 'Moderate Portfolio') {
      return (
        <Badge className="bg-amber-600 text-white hover:bg-amber-700 font-bold px-2.5 py-0.5">
          <AlertCircle className="h-3 w-3 mr-1" /> Moderate ({sc}/60)
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-600 text-white hover:bg-rose-700 font-bold px-2.5 py-0.5">
        <X className="h-3 w-3 mr-1" /> Needs Improvement ({sc}/60)
      </Badge>
    );
  };

  // Filtered & Sorted Sheet Candidates
  const filteredCandidates = sheetCandidates
    .filter((c) => {
      const score = c.portfolioScore ?? 0;
      if (sheetFilter === 'all') return true;
      if (sheetFilter === 'outstanding') return score >= 50;
      if (sheetFilter === 'strong') return score >= 40 && score < 50;
      if (sheetFilter === 'moderate') return score >= 30 && score < 40;
      if (sheetFilter === 'needs_work') return score < 30;
      return true;
    })
    .sort((a, b) => {
      if (sheetSortOrder === 'highest') {
        return (b.portfolioScore ?? 0) - (a.portfolioScore ?? 0);
      }
      if (sheetSortOrder === 'lowest') {
        return (a.portfolioScore ?? 0) - (b.portfolioScore ?? 0);
      }
      return a.rowNumber - b.rowNumber;
    });

  // Copy Single Report
  const handleCopySingleReport = () => {
    if (!singleResult) return;
    const text = `Portfolio Check Audit Report
URL: ${singleResult.url}
Score: ${singleResult.totalScore}/60 (${singleResult.percentage}%)
Grade: ${singleResult.grade} (${singleResult.gradeBangla})

Criteria Breakdown (12 Criteria):
${singleResult.criteriaList
  .map(
    (c, i) =>
      `${i + 1}. ${c.name} (${c.nameBangla}): ${c.score}/${c.maxScore} Marks [${c.passed ? 'PASSED' : 'ACTION REQUIRED'}]\n   - ${c.details}`,
  )
  .join('\n')}

Actionable Recommendations:
${singleResult.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    toast.success('Portfolio audit report copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* HEADER SECTION                                           */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
            <Globe className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span>Portfolio Check (60 Marks Rubric)</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Live Portfolio Audit &amp; Evaluation
          </h1>
          <p className="text-sm text-muted-foreground">
            12 criteria rubric, client-side SPA bundle audit, invalid dashboard link filtering, and automatic Google Sheet sync.
          </p>
        </div>

        {/* Tab Toggle: Single vs Google Sheet */}
        <div className="flex rounded-xl border border-violet-200 bg-violet-50/50 p-1 dark:border-violet-900/60 dark:bg-violet-950/30">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'single'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Single Portfolio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sheet')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === 'sheet'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Google Sheet Batch</span>
            {sheetCandidates.length > 0 && (
              <span className="rounded-full bg-violet-200 px-1.5 py-0.2 text-[10px] font-mono font-bold text-violet-900 dark:bg-violet-900 dark:text-violet-200">
                {sheetCandidates.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Google Account Connection Status Bar (for Sheet Mode) */}
      {activeTab === 'sheet' && (
        <div className="rounded-xl border bg-muted/30 p-3 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                googleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold text-foreground">
              {googleConnected
                ? `Google account connected (${googleEmail || 'Direct edit permissions active'})`
                : 'Connect Google Account to write results automatically to sheet (or ensure Edit access)'}
            </span>
          </div>
          {!googleConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href =
                  '/api/google/oauth/connect?return_to=' +
                  encodeURIComponent('/manager/tools/portfolio-check');
              }}
              className="h-7 text-xs font-bold bg-white text-slate-900 border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-white"
            >
              Connect Google Account
            </Button>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: SINGLE PORTFOLIO AUDIT                           */}
      {/* ======================================================== */}
      {activeTab === 'single' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border shadow-xs hover:border-violet-200 transition-all dark:hover:border-violet-900">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-violet-600" /> Student Portfolio Submission
                </CardTitle>
                <CardDescription>
                  Enter candidate name and live portfolio website URL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSingleAudit} className="space-y-4">
                  <div>
                    <Label htmlFor="single-student-name" className="text-xs font-bold">
                      Student Name (Optional)
                    </Label>
                    <Input
                      id="single-student-name"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Enter candidate name (optional)"
                      className="mt-1.5 text-sm focus-visible:ring-violet-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="single-portfolio-url" className="text-xs font-bold">
                      Live Portfolio Link (Vercel, Netlify, Custom Domain)
                    </Label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        id="single-portfolio-url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="https://candidate-portfolio.vercel.app"
                        className="text-sm font-mono focus-visible:ring-violet-500"
                        required={!pastedHtml}
                      />
                      {portfolioUrl && (
                        <a
                          href={portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button variant="outline" size="icon" type="button" className="h-10 w-10">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Cloudflare/WAF Ctrl+U Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHtmlPaste(!showHtmlPaste)}
                      className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center gap-1.5"
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      <span>
                        {showHtmlPaste
                          ? 'Hide Page Source Box'
                          : 'If Cloudflare / WAF blocks, paste page source via Ctrl+U'}
                      </span>
                    </button>

                    {showHtmlPaste && (
                      <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                        <Label htmlFor="single-pasted-html" className="text-[11px] font-bold text-muted-foreground">
                          Paste Page Source HTML (Open site in browser, press Ctrl+U, copy & paste full code):
                        </Label>
                        <Textarea
                          id="single-pasted-html"
                          value={pastedHtml}
                          onChange={(e) => setPastedHtml(e.target.value)}
                          placeholder="<!DOCTYPE html><html>...</html>"
                          className="font-mono text-xs h-28"
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSingleAuditing}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-xs transition-all dark:bg-violet-600 dark:hover:bg-violet-700 dark:text-white"
                  >
                    {isSingleAuditing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Evaluating 12 Rubrics (60 Marks)...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Audit Live Portfolio (60 Marks)
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Results Panel */}
          <div className="lg:col-span-7">
            {singleResult ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Auth Wall / Dashboard Block Error Alert */}
                {singleResult.isBlockedByAuthOrDashboard && (
                  <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 dark:bg-rose-950/40 dark:border-rose-800 space-y-3">
                    <div className="flex items-center gap-2.5 text-rose-800 dark:text-rose-200 font-black text-base">
                      <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                      <span>Invalid Dashboard Link Filtered (Auth Wall Detected)</span>
                    </div>
                    <p className="text-xs text-rose-900 dark:text-rose-300 leading-relaxed">
                      {singleResult.blockedMessage}
                    </p>
                    <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/80 border text-xs font-mono text-muted-foreground">
                      Provided URL: <span className="text-rose-600 font-bold">{singleResult.url}</span>
                    </div>
                  </div>
                )}

                {/* Cloudflare Block Alert */}
                {singleResult.isCloudflareBlocked && (
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 dark:bg-amber-950/40 dark:border-amber-800 space-y-3">
                    <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200 font-black text-base">
                      <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
                      <span>Cloudflare Turnstile or Bot Challenge Detected</span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                      Could not load HTML automatically because a bot challenge is active. Open candidate site in browser, press <strong>Ctrl+U</strong>, copy page source HTML, and paste into the box.
                    </p>
                  </div>
                )}

                {/* Scorecard Display */}
                {!singleResult.isBlockedByAuthOrDashboard && (
                  <Card className="border-border shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-900 p-6 text-white">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-white shadow-inner">
                            <Globe className="h-7 w-7" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black">
                              {studentName || singleResult.pageTitle || 'Portfolio Report'}
                            </h2>
                            <a
                              href={singleResult.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-mono text-white/80 hover:text-white flex items-center gap-1 mt-0.5"
                            >
                              <span className="truncate max-w-[260px]">{singleResult.url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <p className="text-[11px] text-white/60 mt-1">
                              {singleResult.gradeBangla}
                            </p>
                          </div>
                        </div>

                        {/* Total Score Box */}
                        <div className="text-right sm:border-l sm:border-white/10 sm:pl-6 w-full sm:w-auto">
                          <div className="flex sm:flex-col items-center sm:items-end justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                              Portfolio Score
                            </span>
                            <div className="flex items-baseline gap-1 font-mono">
                              <span className="text-4xl font-black text-white">
                                {singleResult.totalScore}
                              </span>
                              <span className="text-lg text-white/60">/ 60</span>
                            </div>
                          </div>
                          <div className="mt-1">
                            {getGradeBadge(singleResult.grade, singleResult.totalScore)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4 Summary Stat Cards */}
                    <CardContent className="p-4 bg-muted/20 border-b">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="rounded-xl border bg-card p-2.5">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Responsive Nav</p>
                          <p
                            className={`text-base font-black ${
                              singleResult.findings.hasNav ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {singleResult.findings.hasNav ? '5/5 Passed' : 'Partial'}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-card p-2.5">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Project Cards</p>
                          <p className="text-base font-black text-foreground">
                            {singleResult.findings.projectCount >= 2 ? '2+ Projects' : `${singleResult.findings.projectCount} Project`}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-card p-2.5">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Project Details</p>
                          <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                            {singleResult.criteria['project_detail_breakdown']?.score || 0}/9 Marks
                          </p>
                        </div>
                        <div className="rounded-xl border bg-card p-2.5">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Experience Bonus</p>
                          <p className="text-base font-black text-emerald-600">
                            3/3 (Full Bonus)
                          </p>
                        </div>
                      </div>
                    </CardContent>

                    {/* 12-Criteria Master Rubric Scorecard */}
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                          12-Criteria Rubric Breakdown
                        </h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopySingleReport}
                          className="h-7 text-xs font-bold"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy Report
                        </Button>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {singleResult.criteriaList.map((crit) => {
                          const isPass = crit.score === crit.maxScore;
                          const isPartial = crit.score > 0 && crit.score < crit.maxScore;

                          return (
                            <div
                              key={crit.id}
                              className={`rounded-xl border p-3 text-xs space-y-1.5 transition-all ${
                                isPass
                                  ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                                  : isPartial
                                  ? 'bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                                  : 'bg-rose-50/40 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-bold text-foreground">
                                  {isPass ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                  ) : isPartial ? (
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                                  )}
                                  <span>{crit.name}</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`font-mono text-[10px] shrink-0 font-bold ${
                                    isPass
                                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                      : isPartial
                                      ? 'border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                      : 'border-rose-300 bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                  }`}
                                >
                                  {crit.score}/{crit.maxScore}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {crit.details}
                              </p>
                              {crit.recommendation && (
                                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 border-t pt-1">
                                  💡 {crit.recommendation}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Recommendations Box */}
                      {singleResult.recommendations.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:bg-amber-950/20 dark:border-amber-800 space-y-2">
                          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wide">
                            <AlertTriangle className="h-4 w-4" /> Actionable Recommendations to reach 60/60
                          </div>
                          <ul className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                            {singleResult.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="font-bold shrink-0">{i + 1}.</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[350px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/20 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                  <Globe className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">No Portfolio Audited Yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Enter candidate live portfolio URL and click &ldquo;Audit Live Portfolio&rdquo;. System evaluates 12 standardized criteria to generate a full 60-mark report.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: GOOGLE SHEET BATCH AUDIT                         */}
      {/* ======================================================== */}
      {activeTab === 'sheet' && (
        <div className="space-y-6">
          {/* Controls Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Google Sheet Batch Auditor
              </CardTitle>
              <CardDescription>
                Provide Google Sheet URL. System reads candidate portfolio links, completes evaluations, and updates ranks & results directly into the sheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Input
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    className="font-mono text-xs pr-10"
                  />
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    title="Open sheet in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <Button
                  onClick={handleFetchSheet}
                  disabled={isFetchingSheet || isScreeningSheet}
                  variant="outline"
                  className="font-bold shrink-0"
                >
                  {isFetchingSheet ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading Sheet...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Load Sheet
                    </span>
                  )}
                </Button>
                <Button
                  onClick={handleRunSheetAudit}
                  disabled={sheetCandidates.length === 0 || isScreeningSheet}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-xs transition-all dark:bg-violet-600 dark:hover:bg-violet-700 dark:text-white shrink-0"
                >
                  {isScreeningSheet ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Batch Auditing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" /> Run Portfolio Audit &amp; Auto-Sync Sheet
                    </span>
                  )}
                </Button>
              </div>

              {/* Status Banner */}
              {sheetSyncStatus && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between">
                  <span>{sheetSyncStatus}</span>
                  <Badge variant="outline" className="border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 text-[10px]">
                    Auto-Sync Active
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Candidates Leaderboard Table */}
          {sheetCandidates.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald-600" /> Candidates Leaderboard ({sheetCandidates.length})
                    </CardTitle>
                    <CardDescription>
                      Candidate scores and evaluations based on the 60-mark Portfolio Check rubric
                    </CardDescription>
                  </div>

                  {/* Filters & Sorting */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setSheetFilter('all')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'all'
                            ? 'bg-violet-600 text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetFilter('outstanding')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'outstanding'
                            ? 'bg-emerald-600 text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Outstanding (50+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetFilter('strong')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'strong'
                            ? 'bg-indigo-600 text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Strong (40-49)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetFilter('moderate')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'moderate'
                            ? 'bg-amber-600 text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Moderate (30-39)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetFilter('needs_work')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'needs_work'
                            ? 'bg-rose-600 text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Needs Work (&lt;30)
                      </button>
                    </div>

                    <select
                      value={sheetSortOrder}
                      onChange={(e) => setSheetSortOrder(e.target.value as any)}
                      aria-label="Sort Candidates"
                      className="rounded-lg border bg-background px-2.5 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="highest">Highest Score (Top Rank)</option>
                      <option value="lowest">Lowest Score</option>
                      <option value="original">Original Sheet Row</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Rank / Row</th>
                      <th className="py-3 px-4">Candidate &amp; Batch</th>
                      <th className="py-3 px-4">Portfolio Link</th>
                      <th className="py-3 px-4">Score &amp; Grade</th>
                      <th className="py-3 px-4">Rubric Highlights</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCandidates.map((cand, idx) => {
                      const score = cand.portfolioScore ?? 0;
                      const hasAudited = cand.syncStatus === 'audited' || cand.syncStatus === 'synced' || cand.portfolioResult !== undefined;

                      return (
                        <tr key={cand.rowNumber} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {idx === 0 && sheetSortOrder === 'highest' && (
                                <span className="text-amber-500">🥇</span>
                              )}
                              {idx === 1 && sheetSortOrder === 'highest' && (
                                <span className="text-slate-400">🥈</span>
                              )}
                              {idx === 2 && sheetSortOrder === 'highest' && (
                                <span className="text-amber-700">🥉</span>
                              )}
                              <span>#{idx + 1}</span>
                              <span className="text-[10px] text-muted-foreground">
                                (Row #{cand.rowNumber})
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-foreground">{cand.name}</p>
                            <p className="text-[11px] text-muted-foreground">{cand.batch}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            {cand.portfolioUrl ? (
                              <a
                                href={cand.portfolioUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-primary hover:underline font-bold max-w-xs truncate"
                              >
                                <Globe className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{cand.portfolioUrl.replace(/^https?:\/\//, '')}</span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">No Portfolio URL</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {hasAudited ? (
                              <div className="space-y-1">
                                <div className="flex items-baseline gap-1.5 font-mono">
                                  <span className="text-base font-black text-foreground">
                                    {score}
                                  </span>
                                  <span className="text-xs text-muted-foreground">/ 60</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    ({cand.portfolioScorePercentage ?? Math.round((score / 60) * 100)}%)
                                  </span>
                                </div>
                                <div>{getGradeBadge(cand.portfolioGrade, score)}</div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Pending Audit
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {cand.portfolioResult ? (
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Nav: {cand.portfolioResult.criteria['nav_bar']?.score || 0}/5
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Projects: {(cand.portfolioResult.criteria['project_cards']?.score || 0) + (cand.portfolioResult.criteria['project_detail_breakdown']?.score || 0)}/15
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Skills: {cand.portfolioResult.criteria['skills_section']?.score || 0}/6
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Contact: {cand.portfolioResult.criteria['contact_section']?.score || 0}/4
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {cand.portfolioResult ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setInspectedCandidate(cand)}
                                className="h-7 text-xs font-bold text-primary hover:text-primary"
                              >
                                Inspect Report →
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Ready to audit
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* LIVE PROGRESS COUNTER MODAL (100% COMPLETE AUTO-DISMISS) */}
      {/* ======================================================== */}
      {isScreeningSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-blue-500 animate-ping" />
                <span className="text-sm font-black text-foreground">
                  Portfolio Batch Audit in Progress...
                </span>
              </div>
              <Badge className="bg-slate-900 text-white font-mono text-xs dark:bg-white dark:text-black">
                {screeningProgress.percentage}%
              </Badge>
            </div>

            {/* Big Counter */}
            <div className="text-center py-2 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Evaluating 60 Marks Rubric Matrix
              </span>
              <div className="flex items-baseline justify-center gap-2 font-mono">
                <span className="text-5xl font-black text-primary">
                  {screeningProgress.current}
                </span>
                <span className="text-2xl font-bold text-muted-foreground">
                  / {screeningProgress.total} Candidates
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                0% AI Tokens • Analyzing Nav, Hero, Skills, Projects &amp; Detail Pages
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-600 to-emerald-500 transition-all duration-150 rounded-full"
                style={{ width: `${screeningProgress.percentage}%` }}
              />
            </div>

            {/* Current Candidate */}
            <div className="rounded-xl border bg-muted/40 p-3 flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                <span className="text-muted-foreground">Auditing: </span>
                <span className="font-bold text-foreground">
                  {screeningProgress.currentName || 'Auditing candidate...'}
                </span>
                {screeningProgress.currentRow > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1 font-mono">
                    (Row #{screeningProgress.currentRow})
                  </span>
                )}
              </div>
              <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 font-mono text-[10px] shrink-0">
                Active
              </Badge>
            </div>

            {/* Live Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg border bg-emerald-50/80 p-2 dark:bg-emerald-950/30">
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                  Outstanding
                </p>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                  {screeningProgress.outstandingCount}
                </p>
              </div>
              <div className="rounded-lg border bg-indigo-50/80 p-2 dark:bg-indigo-950/30">
                <p className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">
                  Strong
                </p>
                <p className="text-base font-black text-indigo-700 dark:text-indigo-400">
                  {screeningProgress.strongCount}
                </p>
              </div>
              <div className="rounded-lg border bg-amber-50/80 p-2 dark:bg-amber-950/30">
                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                  Moderate
                </p>
                <p className="text-base font-black text-amber-700 dark:text-amber-400">
                  {screeningProgress.moderateCount}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50/80 p-2 dark:bg-slate-950/30">
                <p className="text-[10px] font-bold text-slate-800 dark:text-slate-300 uppercase">
                  Avg Score
                </p>
                <p className="text-base font-black text-foreground">
                  {screeningProgress.avgScore}/60
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CANDIDATE INSPECTION MODAL                               */}
      {/* ======================================================== */}
      {inspectedCandidate && inspectedCandidate.portfolioResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {inspectedCandidate.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {inspectedCandidate.batch} • Row #{inspectedCandidate.rowNumber} • {inspectedCandidate.portfolioUrl}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setInspectedCandidate(null)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Score & Grade Header */}
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4 border">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold">
                  Portfolio Score (60 Marks Rubric)
                </span>
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-3xl font-black text-foreground">
                    {inspectedCandidate.portfolioResult.totalScore}
                  </span>
                  <span className="text-base text-muted-foreground">/ 60 Marks</span>
                  <span className="text-xs font-bold text-muted-foreground">
                    ({inspectedCandidate.portfolioResult.percentage}%)
                  </span>
                </div>
              </div>
              <div>
                {getGradeBadge(
                  inspectedCandidate.portfolioResult.grade,
                  inspectedCandidate.portfolioResult.totalScore,
                )}
              </div>
            </div>

            {/* 12 Criteria Breakdown List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                12-Criteria Detailed Evaluation
              </h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {inspectedCandidate.portfolioResult.criteriaList.map((crit) => {
                  const isPass = crit.score === crit.maxScore;
                  const isPartial = crit.score > 0 && crit.score < crit.maxScore;

                  return (
                    <div
                      key={crit.id}
                      className={`rounded-lg border p-2.5 text-xs flex items-start justify-between gap-3 ${
                        isPass
                          ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20'
                          : isPartial
                          ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20'
                          : 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          {isPass ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : isPartial ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                          )}
                          <span>{crit.name}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({crit.nameBangla})
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{crit.details}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] shrink-0 font-bold ${
                          isPass
                            ? 'border-emerald-300 text-emerald-800 bg-emerald-100'
                            : isPartial
                            ? 'border-amber-300 text-amber-800 bg-amber-100'
                            : 'border-rose-300 text-rose-800 bg-rose-100'
                        }`}
                      >
                        {crit.score}/{crit.maxScore}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations */}
            {inspectedCandidate.portfolioResult.recommendations.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:bg-amber-950/20 space-y-1 text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Actionable Recommendations for Improvement:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300 text-[11px]">
                  {inspectedCandidate.portfolioResult.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {inspectedCandidate.portfolioUrl && (
                <a
                  href={inspectedCandidate.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Portfolio
                </a>
              )}
              <Button
                type="button"
                onClick={() => setInspectedCandidate(null)}
                className="h-8 text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
