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
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ExternalLink,
  Copy,
  Download,
  RefreshCw,
  PlayCircle,
  Layers,
  Lock,
  Check,
  X,
  AlertCircle,
  Loader2,
  User,
  Sparkles,
  Award,
  ShieldCheck,
  Code,
  Globe,
  BookOpen,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  GithubEvaluationResult,
  GithubCriterionResult,
  extractGithubUsername,
} from '@/tools/operations/github-check/github-evaluator';
import { GithubCandidateRow } from '@/app/api/tools/github-profile-check/sheet/route';
import { logRealToolUsage } from '@/lib/tools-usage/client';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

export function GithubProfileCheckTool() {
  // Mode selection: Single vs Google Sheet
  const [activeTab, setActiveTab] = useState<'single' | 'sheet'>('single');

  // Single Profile State
  const [usernameInput, setUsernameInput] = useState('');
  const [isSingleAuditing, setIsSingleAuditing] = useState(false);
  const [singleResult, setSingleResult] = useState<GithubEvaluationResult | null>(null);

  // Google Sheet Mode State
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetCandidates, setSheetCandidates] = useState<GithubCandidateRow[]>([]);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isScreeningSheet, setIsScreeningSheet] = useState(false);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<string>('');
  const [sheetFilter, setSheetFilter] = useState<string>('all');
  const [sheetSortOrder, setSheetSortOrder] = useState<'highest' | 'lowest' | 'original'>('highest');
  const [inspectedCandidate, setInspectedCandidate] = useState<GithubCandidateRow | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Live Counter Progress Modal State
  const [screeningProgress, setScreeningProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
    currentName: '',
    currentRow: 0,
    excellentCount: 0,
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
  // SINGLE PROFILE AUDIT
  // -------------------------------------------------------------
  const handleSingleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      toast.error('Please enter a GitHub username or URL.');
      return;
    }

    const cleanUser = extractGithubUsername(usernameInput);
    if (!cleanUser) {
      toast.error('Please enter a valid GitHub username or URL.');
      return;
    }

    setIsSingleAuditing(true);
    try {
      const res = await fetch('/api/tools/github-profile-check/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Failed to audit GitHub profile.');
        return;
      }
      setSingleResult(data.result);
      toast.success(`GitHub profile audit complete for @${cleanUser}! Score: ${data.result.totalScore}/60`);
      logRealToolUsage({
        toolId: 'github-profile-check',
        toolName: 'GitHub Profile Check',
        actionType: 'single_audit',
        candidateCount: 1,
      });
    } catch {
      toast.error('Failed to audit GitHub profile.');
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
      const res = await fetch('/api/tools/github-profile-check/sheet', {
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

    setScreeningProgress({
      current: 0,
      total,
      percentage: 0,
      currentName: 'Preparing Audit Engine...',
      currentRow: 0,
      excellentCount: 0,
      strongCount: 0,
      moderateCount: 0,
      needsWorkCount: 0,
      avgScore: 0,
    });

    setSheetSyncStatus('Evaluating 15 criteria across 6 categories; Google Sheet will update automatically...');

    try {
      // Trigger full audit + auto sheet update on server
      const res = await fetch('/api/tools/github-profile-check/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetUrl,
          action: 'audit',
          candidates: sheetCandidates,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setIsScreeningSheet(false);
        toast.error(data.message || 'Could not complete batch audit.');
        return;
      }

      const auditedRows: GithubCandidateRow[] = data.candidates || [];

      // Run live progressive animation to 100%
      let scoreSum = 0;
      let excellent = 0;
      let strong = 0;
      let moderate = 0;
      let needsWork = 0;

      for (let i = 0; i < auditedRows.length; i++) {
        const row = auditedRows[i];
        const score = row.githubScore || 0;
        scoreSum += score;

        if (score >= 50) excellent++;
        else if (score >= 40) strong++;
        else if (score >= 30) moderate++;
        else needsWork++;

        const currentCount = i + 1;
        const currentPercent = Math.round((currentCount / total) * 100);
        const currentAvg = Math.round(scoreSum / currentCount);

        setScreeningProgress({
          current: currentCount,
          total,
          percentage: currentPercent,
          currentName: row.name,
          currentRow: row.rowNumber,
          excellentCount: excellent,
          strongCount: strong,
          moderateCount: moderate,
          needsWorkCount: needsWork,
          avgScore: currentAvg,
        });

        await new Promise((r) => setTimeout(r, 25));
      }

      // Close modal smoothly at 100%
      setScreeningProgress((prev) => ({ ...prev, current: total, percentage: 100 }));
      await new Promise((r) => setTimeout(r, 400));
      setIsScreeningSheet(false);

      setSheetCandidates(auditedRows);
      setSheetSortOrder('highest');

      if (data.syncedToSheet) {
        setSheetSyncStatus('✓ Results and grades automatically updated and sorted in Google Sheet.');
        toast.success(`Successfully audited ${auditedRows.length} candidates; Google Sheet auto-updated!`);
      } else {
        setSheetSyncStatus(data.syncError ? `Sheet sync warning: ${data.syncError}` : 'Audit completed.');
        toast.success(`GitHub audit complete for all ${auditedRows.length} candidates!`);
      }

      logRealToolUsage({
        toolId: 'github-profile-check',
        toolName: 'GitHub Profile Check',
        actionType: 'batch_audit',
        candidateCount: auditedRows.length,
      });
    } catch {
      setIsScreeningSheet(false);
      toast.error('Failed to process batch audit.');
    }
  };

  // Helper for Grade Styling
  const getGradeBadge = (grade?: string, score?: number) => {
    const sc = score ?? 0;
    if (sc >= 50 || grade === 'Excellent Profile') {
      return (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-2.5 py-0.5">
          <Award className="h-3 w-3 mr-1" /> Excellent Profile ({sc}/60)
        </Badge>
      );
    }
    if (sc >= 40 || grade === 'Strong Profile') {
      return (
        <Badge className="bg-blue-600 text-white hover:bg-blue-700 font-bold px-2.5 py-0.5">
          <ShieldCheck className="h-3 w-3 mr-1" /> Strong Profile ({sc}/60)
        </Badge>
      );
    }
    if (sc >= 30 || grade === 'Moderate Profile') {
      return (
        <Badge className="bg-amber-600 text-white hover:bg-amber-700 font-bold px-2.5 py-0.5">
          <AlertCircle className="h-3 w-3 mr-1" /> Moderate Profile ({sc}/60)
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
      const score = c.githubScore ?? 0;
      if (sheetFilter === 'all') return true;
      if (sheetFilter === 'excellent') return score >= 50;
      if (sheetFilter === 'strong') return score >= 40 && score < 50;
      if (sheetFilter === 'moderate') return score >= 30 && score < 40;
      if (sheetFilter === 'needs_work') return score < 30;
      return true;
    })
    .sort((a, b) => {
      if (sheetSortOrder === 'highest') {
        return (b.githubScore ?? 0) - (a.githubScore ?? 0);
      }
      if (sheetSortOrder === 'lowest') {
        return (a.githubScore ?? 0) - (b.githubScore ?? 0);
      }
      return a.rowNumber - b.rowNumber;
    });

  // Copy Single Report
  const handleCopySingleReport = () => {
    if (!singleResult) return;
    const text = `GitHub Profile Audit Report
Candidate: @${singleResult.username} (${singleResult.name})
Score: ${singleResult.totalScore}/60 (${singleResult.percentage}%)
Grade: ${singleResult.grade} (${singleResult.gradeBangla})
Profile: ${singleResult.profileUrl}

Criteria Breakdown (15 Criteria):
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
    toast.success('GitHub audit report copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* HEADER SECTION                                           */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
            <GithubIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span>GitHub Profile Check (60 Marks Deterministic Evaluator)</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            GitHub Profile Audit &amp; Evaluation
          </h1>
          <p className="text-sm text-muted-foreground">
            15 criteria, 60-mark master rubric, dual fetching architecture (GitHub API + Raw CDN Scraper), and 0% AI token usage.
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
            <span>Single Profile</span>
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
                  encodeURIComponent('/manager/tools/github-profile-check');
              }}
              className="h-7 text-xs font-bold bg-white text-slate-900 border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-white"
            >
              Connect Google Account
            </Button>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: SINGLE GITHUB PROFILE AUDIT                      */}
      {/* ======================================================== */}
      {activeTab === 'single' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Form */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border shadow-xs hover:border-violet-200 transition-all dark:hover:border-violet-900">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Search className="h-4 w-4 text-violet-600" /> Profile Lookup
                </CardTitle>
                <CardDescription>
                  Enter candidate GitHub username or profile URL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSingleAudit} className="space-y-4">
                  <div>
                    <Label htmlFor="single-github-user" className="text-xs font-bold">
                      GitHub Username or Profile Link
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3.5 top-2.5 text-xs font-bold text-muted-foreground">
                        @
                      </span>
                      <Input
                        id="single-github-user"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Enter GitHub username or profile link..."
                        className="pl-8 text-sm focus-visible:ring-violet-500"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSingleAuditing}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-xs transition-all dark:bg-violet-600 dark:hover:bg-violet-700 dark:text-white"
                  >
                    {isSingleAuditing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing 15 Criteria (60 Marks)...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Audit GitHub Profile (60 Marks)
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
                {/* Profile Header Scorecard */}
                <Card className="border-border shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-900 p-6 text-white">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={singleResult.avatarUrl}
                            alt={singleResult.username}
                            className="h-16 w-16 rounded-2xl border-2 border-white/20 object-cover shadow-lg"
                          />
                          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-violet-950 border border-white/20">
                            <GithubIcon className="h-3.5 w-3.5 text-white" />
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black">{singleResult.name}</h2>
                            <a
                              href={singleResult.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-white/60 hover:text-white transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                          <p className="text-xs font-mono text-white/70">@{singleResult.username}</p>
                          {singleResult.location && (
                            <p className="text-xs text-white/60 mt-0.5">📍 {singleResult.location}</p>
                          )}
                        </div>
                      </div>

                      {/* Big Score Box */}
                      <div className="text-right sm:border-l sm:border-white/10 sm:pl-6 w-full sm:w-auto">
                        <div className="flex sm:flex-col items-center sm:items-end justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                            Overall Score
                          </span>
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className="text-3xl sm:text-4xl font-black text-white">
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

                    {/* Bio snippet */}
                    {singleResult.bio && (
                      <p className="mt-4 text-xs italic text-white/80 border-t border-white/10 pt-3">
                        &ldquo;{singleResult.bio}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* 4 Summary Stat Cards */}
                  <CardContent className="p-4 bg-muted/20 border-b">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="rounded-xl border bg-card p-2.5">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Public Repos</p>
                        <p className="text-lg font-black text-foreground">
                          {singleResult.publicReposCount}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-card p-2.5">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Profile README</p>
                        <p
                          className={`text-lg font-black ${
                            singleResult.hasProfileReadme ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {singleResult.hasProfileReadme ? 'Verified' : 'Missing'}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-card p-2.5">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Live Demos</p>
                        <p
                          className={`text-lg font-black ${
                            singleResult.repoSummary.reposWithLiveDemo > 0
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {singleResult.repoSummary.reposWithLiveDemo > 0 ? 'Detected' : 'None'}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-card p-2.5">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Engine Mode</p>
                        <p className="text-xs font-black text-purple-600 mt-1 uppercase">
                          0% AI Tokens
                        </p>
                      </div>
                    </div>
                  </CardContent>

                  {/* 15 Criteria Master Rubric Detailed Grid */}
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                        15-Criteria Master Rubric Scorecard
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
                                {crit.score}/{crit.maxScore} Marks
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
              </div>
            ) : (
              <div className="flex h-full min-h-[350px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/20 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                  <GithubIcon className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">No Profile Checked Yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  Enter candidate GitHub username on the left and click &ldquo;Audit GitHub Profile&rdquo;. System evaluates 15 deterministic criteria for a comprehensive 60-mark audit.
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
                Provide Google Sheet URL. System reads candidate GitHub links, evaluates all criteria, and updates ranks & results directly into the sheet.
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
                      <PlayCircle className="h-4 w-4" /> Run GitHub Audit &amp; Auto-Sync Sheet
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
                      Candidate scores and evaluations based on the 60-mark GitHub Profile Check rubric
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
                        onClick={() => setSheetFilter('excellent')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'excellent'
                            ? 'bg-emerald-600 text-white'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Excellent (50+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetFilter('strong')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                          sheetFilter === 'strong'
                            ? 'bg-blue-600 text-white'
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
                      <th className="py-3 px-4">GitHub Profile</th>
                      <th className="py-3 px-4">Score &amp; Grade</th>
                      <th className="py-3 px-4">Rubric Highlights</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCandidates.map((cand, idx) => {
                      const score = cand.githubScore ?? 0;
                      const hasAudited = cand.syncStatus === 'audited' || cand.syncStatus === 'synced' || cand.githubResult !== undefined;

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
                            {cand.githubUsername ? (
                              <a
                                href={cand.githubUrl || `https://github.com/${cand.githubUsername}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-primary hover:underline font-bold"
                              >
                                <GithubIcon className="h-3.5 w-3.5" />
                                <span>@{cand.githubUsername}</span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">No GitHub URL</span>
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
                                    ({cand.githubScorePercentage ?? Math.round((score / 60) * 100)}%)
                                  </span>
                                </div>
                                <div>{getGradeBadge(cand.githubGrade, score)}</div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Pending Audit
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {cand.githubResult ? (
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Identity: {(cand.githubResult.criteria['profile_image']?.score || 0) + (cand.githubResult.criteria['location']?.score || 0) + (cand.githubResult.criteria['contact_info']?.score || 0)}/10
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Skills: {cand.githubResult.criteria['skills_with_icons']?.score || 0}/8
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Repos: {(cand.githubResult.criteria['pinned_repos']?.score || 0) + (cand.githubResult.criteria['repo_description']?.score || 0)}/12
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  Demos: {cand.githubResult.criteria['live_demo']?.score || 0}/4
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {cand.githubResult ? (
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
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-sm font-black text-foreground">
                  GitHub Profile Batch Audit in Progress...
                </span>
              </div>
              <Badge className="bg-slate-900 text-white font-mono text-xs dark:bg-white dark:text-black">
                {screeningProgress.percentage}%
              </Badge>
            </div>

            {/* Big Counter */}
            <div className="text-center py-2 space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Evaluating 60 Marks Deterministic Rubric
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
                0% AI Tokens • Analyzing Repos, Readmes, Demos &amp; Visual Icons
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
                  Excellent
                </p>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                  {screeningProgress.excellentCount}
                </p>
              </div>
              <div className="rounded-lg border bg-blue-50/80 p-2 dark:bg-blue-950/30">
                <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">
                  Strong
                </p>
                <p className="text-base font-black text-blue-700 dark:text-blue-400">
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
      {inspectedCandidate && inspectedCandidate.githubResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-foreground">
                  {inspectedCandidate.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {inspectedCandidate.batch} • Row #{inspectedCandidate.rowNumber} • @{inspectedCandidate.githubUsername}
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
                  GitHub Profile Score (60 Marks Rubric)
                </span>
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-3xl font-black text-foreground">
                    {inspectedCandidate.githubResult.totalScore}
                  </span>
                  <span className="text-base text-muted-foreground">/ 60 Marks</span>
                  <span className="text-xs font-bold text-muted-foreground">
                    ({inspectedCandidate.githubResult.percentage}%)
                  </span>
                </div>
              </div>
              <div>
                {getGradeBadge(
                  inspectedCandidate.githubResult.grade,
                  inspectedCandidate.githubResult.totalScore,
                )}
              </div>
            </div>

            {/* 15 Criteria Breakdown List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                15 Criteria Detailed Evaluation
              </h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {inspectedCandidate.githubResult.criteriaList.map((crit) => {
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
            {inspectedCandidate.githubResult.recommendations.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:bg-amber-950/20 space-y-1 text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Actionable Recommendations for Improvement:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300 text-[11px]">
                  {inspectedCandidate.githubResult.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {inspectedCandidate.githubUrl && (
                <a
                  href={inspectedCandidate.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open GitHub Profile
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
