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
  Tv,
  Video,
  Mic,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Plus,
  Play,
  RotateCcw,
  Save,
  CheckCheck,
  Download,
  Copy,
  ExternalLink,
  Search,
  Users,
  BookOpen,
  Sparkles,
  Clock,
  Trash2,
  FileSpreadsheet,
  FileText,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Eye,
  Camera,
  MessageSquare,
  HelpCircle,
  Loader2,
  RefreshCw,
  X,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { logRealToolUsage } from '@/lib/tools-usage/client';

import {
  Interview,
  Student,
  Feedback,
  TechnicalSection,
  GradedQuestion,
  RatingLevel,
  ProblemSolvingStatus,
  FinalRecommendation,
  QuestionStatus,
} from '@/tools/operations/nexview/nexview-types';
import {
  DEFAULT_COURSE_TEMPLATES,
  INITIAL_STUDENTS,
  INITIAL_INTERVIEWS,
} from '@/tools/operations/nexview/default-templates';
import {
  computeAutoFeedback,
  generateNexViewTsv,
  generateNexViewCsv,
  escapeTsvCell,
} from '@/tools/operations/nexview/nexview-engine';

export function NexViewToolView() {
  // Navigation Views: 'queue' (Candidate Roster) | 'studio' (Live Assessment Console) | 'templates' (Question Bank Setup)
  const [activeView, setActiveView] = useState<'queue' | 'studio' | 'templates'>('queue');

  // Roster & Interviews State
  const [students, setStudents] = useState<Student[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);

  // Active Interview Session State
  const [activeInterview, setActiveInterview] = useState<Interview | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Live Timer
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualStudentModal, setShowManualStudentModal] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showSheetSyncModal, setShowSheetSyncModal] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [pastedCsvInput, setPastedCsvInput] = useState('');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // New Student Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentCourse, setNewStudentCourse] = useState('Full Stack Development');
  const [newStudentBatch, setNewStudentBatch] = useState('Batch 10');
  const [newStudentSlot, setNewStudentSlot] = useState('Slot 1: 10:00 AM - 10:20 AM');

  // Google Doc Importer Form
  const [googleDocUrl, setGoogleDocUrl] = useState('');
  const [isImportingDoc, setIsImportingDoc] = useState(false);

  // Custom question / section inputs in studio
  const [customQuestionInputs, setCustomQuestionInputs] = useState<Record<string, string>>({});
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [showAddSectionBox, setShowAddSectionBox] = useState(false);

  // Load Initial Data from API or Cache
  useEffect(() => {
    fetch('/api/tools/nexview/students')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.students && data.students.length > 0) {
          setStudents(data.students);
          setInterviews(data.interviews || []);
        }
      })
      .catch(() => {});
  }, []);

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // -------------------------------------------------------------
  // START / RESUME INTERVIEW
  // -------------------------------------------------------------
  const handleStartInterview = async (interviewItem: Interview) => {
    try {
      const res = await fetch('/api/tools/nexview/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: interviewItem.studentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Failed to start interview.');
        return;
      }

      const startedInterview: Interview = data.interview;
      setActiveInterview(startedInterview);
      setFeedback(startedInterview.feedback || null);
      setSelectedInterviewId(startedInterview.id);

      // Update local roster list
      setInterviews((prev) =>
        prev.map((i) => (i.id === startedInterview.id ? startedInterview : i)),
      );

      // Start timer
      setSessionSeconds(0);
      setIsTimerRunning(true);
      setActiveView('studio');

      toast.success(
        `${startedInterview.student.name}'s interview session started (Status: Interview Started)`,
      );
    } catch {
      toast.error('Failed to communicate with server.');
    }
  };

  // -------------------------------------------------------------
  // SAVE DRAFT
  // -------------------------------------------------------------
  const handleSaveDraft = async () => {
    if (!activeInterview || !feedback) return;
    try {
      const res = await fetch(`/api/tools/nexview/feedback/${activeInterview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Could not save draft.');
        return;
      }

      const updated = data.interview;
      setActiveInterview(updated);
      setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast.success('Draft saved successfully (Status: Draft Saved)');
    } catch {
      toast.error('Failed to save draft.');
    }
  };

  // -------------------------------------------------------------
  // AUTO GENERATE FEEDBACK
  // -------------------------------------------------------------
  const handleAutoGenerateFeedback = () => {
    if (!feedback || !activeInterview) return;
    const computed = computeAutoFeedback(feedback, activeInterview.student.name);

    setFeedback((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        finalComment: computed.finalComment,
      };
    });

    toast.success(
      `Auto-feedback generated! Evaluation: ${computed.solvedCount} Solved (${computed.passPercentage}%), ${computed.partialCount} Partial`,
    );
  };

  // -------------------------------------------------------------
  // SUBMIT FINAL
  // -------------------------------------------------------------
  const handleFinalSubmit = async () => {
    if (!activeInterview || !feedback) return;

    // Validation checks
    if (!feedback.finalRecommendation) {
      toast.error('Please select a Final Recommendation.');
      return;
    }
    if (!feedback.interpersonalLevel) {
      toast.error('Interpersonal Skills rating is required.');
      return;
    }
    if (!feedback.bengaliLevel && !feedback.englishLevel) {
      toast.error('Please provide at least one Language Proficiency rating (Bengali or English).');
      return;
    }
    if (feedback.cameraOn && (!feedback.eyeContact || !feedback.backgroundLevel)) {
      toast.error('Please provide Eye Contact and Background ratings when camera is active.');
      return;
    }

    try {
      const res = await fetch(`/api/tools/nexview/feedback/${activeInterview.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Failed to submit interview feedback.');
        return;
      }

      const updated = data.interview;
      setActiveInterview(updated);
      setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setIsTimerRunning(false);
      setShowSubmitConfirmModal(false);

      toast.success(`Interview completed successfully! Status: Completed`);
      logRealToolUsage({
        toolId: 'nexview-tool',
        toolName: 'NexView Screening Tool',
        actionType: 'single_audit',
        candidateCount: 1,
      });
    } catch {
      toast.error('Failed to submit final interview report.');
    }
  };

  // -------------------------------------------------------------
  // QUESTION GRADING IN STUDIO
  // -------------------------------------------------------------
  const handleGradeQuestion = (
    sectionId: string,
    questionId: string,
    newStatus: QuestionStatus,
  ) => {
    if (!feedback || activeInterview?.status === 'Completed') return;

    const updatedSections = (feedback.technicalEvaluation || []).map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.map((q) => {
          if (q.id !== questionId) return q;
          return { ...q, status: newStatus };
        }),
      };
    });

    setFeedback({
      ...feedback,
      technicalEvaluation: updatedSections,
    });
  };

  // Add Question from Dropdown or Custom Input
  const handleAddQuestion = (sectionId: string, questionText: string) => {
    if (!questionText.trim() || !feedback || activeInterview?.status === 'Completed') return;

    const newQuestion: GradedQuestion = {
      id: `Q-${sectionId}-${Date.now().toString().slice(-4)}`,
      text: questionText.trim(),
      status: 'unanswered',
    };

    const updatedSections = (feedback.technicalEvaluation || []).map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        questions: [...sec.questions, newQuestion],
      };
    });

    setFeedback({ ...feedback, technicalEvaluation: updatedSections });
    setCustomQuestionInputs((prev) => ({ ...prev, [sectionId]: '' }));
    toast.success('Question added successfully.');
  };

  // Delete Question
  const handleDeleteQuestion = (sectionId: string, questionId: string) => {
    if (!feedback || activeInterview?.status === 'Completed') return;

    const updatedSections = (feedback.technicalEvaluation || []).map((sec) => {
      if (sec.id !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.filter((q) => q.id !== questionId),
      };
    });

    setFeedback({ ...feedback, technicalEvaluation: updatedSections });
  };

  // Add New Section on the fly
  const handleAddNewSection = () => {
    if (!newSectionLabel.trim() || !feedback) return;
    const newSec: TechnicalSection = {
      id: newSectionLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: newSectionLabel.trim(),
      questions: [],
    };
    setFeedback({
      ...feedback,
      technicalEvaluation: [...(feedback.technicalEvaluation || []), newSec],
    });
    setNewSectionLabel('');
    setShowAddSectionBox(false);
    toast.success(`New topic section "${newSec.label}" added!`);
  };

  // -------------------------------------------------------------
  // EXPORT: COPY TSV (FOR DIRECT GOOGLE SHEET PASTE)
  // -------------------------------------------------------------
  const handleCopyTsv = () => {
    if (interviews.length === 0) {
      toast.error('No interview records to copy.');
      return;
    }
    const tsvText = generateNexViewTsv(interviews);
    navigator.clipboard.writeText(tsvText);
    toast.success(
      'Copied 15 formatted columns to clipboard ready to paste into Google Sheet (Ctrl+V)!',
    );
  };

  // -------------------------------------------------------------
  // EXPORT: DOWNLOAD CSV
  // -------------------------------------------------------------
  const handleDownloadCsv = () => {
    if (interviews.length === 0) {
      toast.error('No records available to download.');
      return;
    }
    const csvContent = generateNexViewCsv(interviews);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NexView_Interviews_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('15-column CSV download complete!');
  };

  // -------------------------------------------------------------
  // DIRECT GOOGLE SHEET SYNC
  // -------------------------------------------------------------
  const handleSyncToSheet = async () => {
    if (!sheetUrlInput.trim()) {
      toast.error('Please provide a Google Sheet link.');
      return;
    }
    setIsSyncingSheet(true);
    try {
      const res = await fetch('/api/tools/nexview/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrlInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Failed to sync with Google Sheet.');
        return;
      }
      setShowSheetSyncModal(false);
      toast.success(data.message || 'Successfully updated 15 columns in Google Sheet!');
      logRealToolUsage({
        toolId: 'nexview-tool',
        toolName: 'NexView Screening Tool',
        actionType: 'batch_audit',
        candidateCount: interviews.length,
      });
    } catch {
      toast.error('Failed to write data to Google Sheet.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // -------------------------------------------------------------
  // IMPORT CANDIDATES FROM GOOGLE SHEET
  // -------------------------------------------------------------
  const handleImportSheet = async () => {
    if (!sheetUrlInput.trim() && !pastedCsvInput.trim()) {
      toast.error('Please provide a Google Sheet link or CSV data.');
      return;
    }
    try {
      const res = await fetch('/api/tools/nexview/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          sheetUrl: sheetUrlInput,
          pastedCsv: pastedCsvInput,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Import failed.');
        return;
      }
      setStudents(data.students);
      setInterviews(data.interviews);
      setShowImportModal(false);
      toast.success(data.message);
    } catch {
      toast.error('Failed to import candidates.');
    }
  };

  // -------------------------------------------------------------
  // ADD MANUAL STUDENT
  // -------------------------------------------------------------
  const handleAddManualStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) {
      toast.error('Name and Email are required.');
      return;
    }
    try {
      const res = await fetch('/api/tools/nexview/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual',
          student: {
            name: newStudentName.trim(),
            email: newStudentEmail.trim(),
            phone: newStudentPhone.trim(),
            course: newStudentCourse,
            batch: newStudentBatch,
            slot: newStudentSlot,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Could not add candidate.');
        return;
      }

      setStudents((prev) => [data.student, ...prev.filter((s) => s.id !== data.student.id)]);
      setInterviews((prev) => [data.interview, ...prev.filter((i) => i.id !== data.interview.id)]);
      setShowManualStudentModal(false);
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentPhone('');
      toast.success('Candidate added and interview session assigned!');
    } catch {
      toast.error('Failed to add candidate.');
    }
  };

  // -------------------------------------------------------------
  // IMPORT GOOGLE DOC QUESTIONS
  // -------------------------------------------------------------
  const handleImportDocQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleDocUrl.trim()) {
      toast.error('Please provide a Google Doc URL.');
      return;
    }
    setIsImportingDoc(true);
    try {
      const res = await fetch('/api/tools/nexview/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docUrl: googleDocUrl, course: 'Full Stack Development' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || 'Failed to import Google Doc.');
        return;
      }
      toast.success(data.message);
      setGoogleDocUrl('');
    } catch {
      toast.error('Could not load questions from Google Doc.');
    } finally {
      setIsImportingDoc(false);
    }
  };

  // Filtered Roster
  const filteredInterviews = interviews.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      item.student.name.toLowerCase().includes(q) ||
      item.student.email.toLowerCase().includes(q) ||
      item.student.phone?.toLowerCase().includes(q) ||
      item.course.toLowerCase().includes(q);

    const matchCourse = courseFilter === 'all' || item.course === courseFilter;
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchSearch && matchCourse && matchStatus;
  });

  // Calculate live question stats in studio
  const liveStats = React.useMemo(() => {
    if (!feedback) return { solved: 0, partial: 0, cantSolve: 0, total: 0, percentage: 0 };
    let solved = 0;
    let partial = 0;
    let cantSolve = 0;
    (feedback.technicalEvaluation || []).forEach((sec) => {
      (sec.questions || []).forEach((q) => {
        if (q.status === 'solved') solved++;
        else if (q.status === 'partial') partial++;
        else if (q.status === 'cant_solve') cantSolve++;
      });
    });
    const total = solved + partial + cantSolve;
    const percentage = total > 0 ? Math.round((solved / total) * 100) : 0;
    return { solved, partial, cantSolve, total, percentage };
  }, [feedback]);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* TOP HEADER SECTION                                       */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Tv className="h-4 w-4" />
            <span>NexView Candidate Screening Matrix &amp; Live Studio</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            NexView Tool (Live Interview Assessment)
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time candidate interview assessment, live grading console, soft skills evaluation, and 1-click Google Sheet sync.
          </p>
        </div>

        {/* Global Action & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyTsv}
            className="h-8 text-xs font-bold border-slate-300 dark:border-slate-700"
            title="Copy 15 formatted columns for Google Sheet"
          >
            <Copy className="h-3.5 w-3.5 mr-1 text-emerald-600" />
            Copy for Google Sheet (TSV)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCsv}
            className="h-8 text-xs font-bold border-slate-300 dark:border-slate-700"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-blue-600" />
            Download CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setShowSheetSyncModal(true)}
            className="h-8 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            Sync Google Sheet
          </Button>
        </div>
      </div>

      {/* Main Mode View Toggle */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="inline-flex p-1 rounded-xl bg-muted border text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveView('queue')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
              activeView === 'queue'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Candidate Queue ({interviews.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!activeInterview && interviews.length > 0) {
                handleStartInterview(interviews[0]);
              } else {
                setActiveView('studio');
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
              activeView === 'studio'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tv className="h-3.5 w-3.5" />
            <span>Live Interview Studio</span>
            {activeInterview && (
              <Badge className="bg-emerald-600 text-white font-mono text-[10px] h-4 px-1">
                {activeInterview.student.name.split(' ')[0]}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('templates')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
              activeView === 'templates'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Course Templates &amp; Questions</span>
          </button>
        </div>

        {/* Live Timer Indicator when in studio */}
        {activeView === 'studio' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-1 font-mono text-xs font-bold">
              <Clock className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span>Session: {formatTimer(sessionSeconds)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: CANDIDATE QUEUE & ROSTER                         */}
      {/* ======================================================== */}
      {activeView === 'queue' && (
        <div className="space-y-5">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5">
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Candidates</p>
              <p className="text-2xl font-black text-foreground mt-0.5">{interviews.length}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs text-muted-foreground uppercase font-bold">Assigned Queue</p>
              <p className="text-2xl font-black text-blue-600 mt-0.5">
                {interviews.filter((i) => i.status === 'Assigned' || i.status === 'Pending').length}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs text-muted-foreground uppercase font-bold">Drafts Saved</p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">
                {interviews.filter((i) => i.status === 'Draft Saved' || i.status === 'Interview Started').length}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-xs text-muted-foreground uppercase font-bold">Completed</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">
                {interviews.filter((i) => i.status === 'Completed').length}
              </p>
            </Card>
          </div>

          {/* Controls Bar: Search, Filters, Import */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, phone or course..."
                  className="pl-9 text-xs"
                />
              </div>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                aria-label="Filter by Course"
                className="rounded-lg border bg-background px-3 py-2 text-xs font-bold text-foreground"
              >
                <option value="all">All Courses</option>
                <option value="Full Stack Development">Full Stack Development</option>
                <option value="Frontend Development">Frontend Development</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="rounded-lg border bg-background px-3 py-2 text-xs font-bold text-foreground"
              >
                <option value="all">All Statuses</option>
                <option value="Assigned">Assigned</option>
                <option value="Interview Started">In Progress</option>
                <option value="Draft Saved">Draft Saved</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowManualStudentModal(true)}
                className="text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Candidate
              </Button>
              <Button
                size="sm"
                onClick={() => setShowImportModal(true)}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Batch Import Sheet
              </Button>
            </div>
          </div>

          {/* Candidate Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Course &amp; Batch</th>
                    <th className="py-3 px-4">Slot</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recommendation</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInterviews.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Users className="h-8 w-8 text-muted-foreground/40" />
                          <p className="text-sm font-semibold text-foreground">No candidates in queue</p>
                          <p className="text-xs text-muted-foreground">Click &quot;+ Add Candidate&quot; or &quot;Batch Import Sheet&quot; to get started.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInterviews.map((item) => {
                    const isCompleted = item.status === 'Completed';
                    const isDraft = item.status === 'Draft Saved' || item.status === 'Interview Started';

                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-foreground text-sm">{item.student.name}</p>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {item.student.id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-mono text-foreground">{item.student.email}</p>
                          <p className="text-muted-foreground">{item.student.phone || '—'}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-foreground">{item.course}</p>
                          <p className="text-[11px] text-muted-foreground">{item.batch}</p>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                          {item.student.slot || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isCompleted ? (
                            <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                              Completed
                            </Badge>
                          ) : isDraft ? (
                            <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                              {item.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-600 border-blue-300 font-bold text-[10px]">
                              {item.status}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.feedback?.finalRecommendation ? (
                            <span className="font-semibold text-xs text-foreground">
                              {item.feedback.finalRecommendation}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">
                              Pending Evaluation
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isCompleted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveInterview(item);
                                setFeedback(item.feedback || null);
                                setActiveView('studio');
                              }}
                              className="h-7 text-xs font-bold text-primary hover:text-primary"
                            >
                              <Eye className="h-3 w-3 mr-1" /> View Report
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleStartInterview(item)}
                              className="h-7 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {isDraft ? 'Resume Draft' : 'Start Interview'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: THE CORE LIVE INTERVIEW ASSESSMENT STUDIO        */}
      {/* ======================================================== */}
      {activeView === 'studio' && activeInterview && feedback && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Studio Top Control Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white">
                <Tv className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black">{activeInterview.student.name}</h2>
                  <Badge className="bg-emerald-500/80 text-white text-[10px]">
                    {activeInterview.status}
                  </Badge>
                </div>
                <p className="text-xs text-white/70">
                  {activeInterview.course} • {activeInterview.batch} • {activeInterview.student.slot}
                </p>
              </div>
            </div>

            {/* Quick Live Stream Badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs">
                <Video className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold text-white/90">Camera HD</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs">
                <Mic className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold text-white/90">Mic Active</span>
              </div>

              {/* Action Buttons */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={activeInterview.status === 'Completed'}
                className="h-8 text-xs font-bold bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSubmitConfirmModal(true)}
                disabled={activeInterview.status === 'Completed'}
                className="h-8 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                {activeInterview.status === 'Completed' ? 'Completed' : 'Submit Final'}
              </Button>
            </div>
          </div>

          {/* 2-Column Live Form */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* ---------------------------------------------------- */}
            {/* LEFT COLUMN: CANDIDATE PARAMETERS & OBSERVATIONS    */}
            {/* ---------------------------------------------------- */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. Language Proficiency */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" /> 1. Language Proficiency
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* English */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs font-bold">English Communication</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {feedback.englishLevel || 'Select'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(['Poor', 'Below Average', 'Average', 'Good', 'Excellent'] as RatingLevel[]).map(
                        (lvl, i) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setFeedback({ ...feedback, englishLevel: lvl })}
                            disabled={activeInterview.status === 'Completed'}
                            className={`rounded-lg border py-1 text-[10px] font-bold transition-all ${
                              feedback.englishLevel === lvl
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {i + 1}★ {lvl.slice(0, 4)}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Bengali */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs font-bold">Bengali Communication</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {feedback.bengaliLevel || 'Select'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(['Poor', 'Below Average', 'Average', 'Good', 'Excellent'] as RatingLevel[]).map(
                        (lvl, i) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setFeedback({ ...feedback, bengaliLevel: lvl })}
                            disabled={activeInterview.status === 'Completed'}
                            className={`rounded-lg border py-1 text-[10px] font-bold transition-all ${
                              feedback.bengaliLevel === lvl
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {i + 1}★ {lvl.slice(0, 4)}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Camera & Environment */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" /> 2. Camera &amp; Environment
                    </CardTitle>
                    <button
                      type="button"
                      disabled={activeInterview.status === 'Completed'}
                      onClick={() =>
                        setFeedback({ ...feedback, cameraOn: !feedback.cameraOn })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        feedback.cameraOn
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {feedback.cameraOn ? 'Camera ON' : 'Camera OFF'}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {feedback.cameraOn ? (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div>
                        <Label className="text-xs font-bold">Eye Contact</Label>
                        <div className="grid grid-cols-5 gap-1 mt-1">
                          {(['Poor', 'Below Average', 'Average', 'Good', 'Excellent'] as RatingLevel[]).map(
                            (lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                disabled={activeInterview.status === 'Completed'}
                                onClick={() => setFeedback({ ...feedback, eyeContact: lvl })}
                                className={`rounded-lg border py-1 text-[10px] font-bold ${
                                  feedback.eyeContact === lvl
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-muted/40 text-muted-foreground'
                                }`}
                              >
                                {lvl.slice(0, 4)}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-bold">Background &amp; Lighting</Label>
                        <div className="grid grid-cols-5 gap-1 mt-1">
                          {(['Poor', 'Below Average', 'Average', 'Good', 'Excellent'] as RatingLevel[]).map(
                            (lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                disabled={activeInterview.status === 'Completed'}
                                onClick={() => setFeedback({ ...feedback, backgroundLevel: lvl })}
                                className={`rounded-lg border py-1 text-[10px] font-bold ${
                                  feedback.backgroundLevel === lvl
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-muted/40 text-muted-foreground'
                                }`}
                              >
                                {lvl.slice(0, 4)}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Camera is disabled (ratings will automatically save as null upon submission).
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 3. Problem Solving & Soft Skills */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> 3. Soft Skills &amp; Problem Solving
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Problem Solving Level */}
                  <div>
                    <Label className="text-xs font-bold">Problem Solving Ability</Label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      {(
                        [
                          { id: 'solved', label: 'Solved', color: 'bg-emerald-600' },
                          { id: 'partially_solved', label: 'Partial', color: 'bg-amber-600' },
                          { id: 'cant_solve', label: "Can't Solve", color: 'bg-rose-600' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={activeInterview.status === 'Completed'}
                          onClick={() => setFeedback({ ...feedback, problemSolvingLevel: item.id })}
                          className={`rounded-lg border py-1.5 text-xs font-bold transition-all ${
                            feedback.problemSolvingLevel === item.id
                              ? `${item.color} text-white`
                              : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interpersonal Level */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs font-bold">Interpersonal &amp; Confidence</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {feedback.interpersonalLevel || 'Select'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(['Poor', 'Below Average', 'Average', 'Good', 'Excellent'] as RatingLevel[]).map(
                        (lvl, i) => (
                          <button
                            key={lvl}
                            type="button"
                            disabled={activeInterview.status === 'Completed'}
                            onClick={() => setFeedback({ ...feedback, interpersonalLevel: lvl })}
                            className={`rounded-lg border py-1 text-[10px] font-bold ${
                              feedback.interpersonalLevel === lvl
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-muted/40 text-muted-foreground'
                            }`}
                          >
                            {i + 1}★ {lvl.slice(0, 4)}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Final Recommendation & Auto Feedback Generator */}
              <Card className="border-indigo-200 dark:border-indigo-900 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Award className="h-4 w-4 text-indigo-600" /> 4. Final Verdict &amp; Summary
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAutoGenerateFeedback}
                      disabled={activeInterview.status === 'Completed'}
                      className="h-7 text-xs font-bold border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300"
                    >
                      <Sparkles className="h-3 w-3 mr-1" /> Auto-Generate Feedback
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 4 Recommendation Radio Cards */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {
                          id: 'Strongly Recommended (Potential Candidate)',
                          label: 'Strongly Recommended',
                          color: 'bg-emerald-600 text-white border-emerald-600',
                        },
                        {
                          id: 'Recommended',
                          label: 'Recommended',
                          color: 'bg-blue-600 text-white border-blue-600',
                        },
                        {
                          id: 'Need Improvement',
                          label: 'Need Improvement',
                          color: 'bg-amber-600 text-white border-amber-600',
                        },
                        {
                          id: 'Not Recommended',
                          label: 'Not Recommended',
                          color: 'bg-rose-600 text-white border-rose-600',
                        },
                      ] as const
                    ).map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        disabled={activeInterview.status === 'Completed'}
                        onClick={() => setFeedback({ ...feedback, finalRecommendation: rec.id })}
                        className={`rounded-lg border p-2 text-left text-xs font-bold transition-all ${
                          feedback.finalRecommendation === rec.id
                            ? rec.color
                            : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {rec.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <Label htmlFor="studio-final-comment" className="text-xs font-bold">
                      General Feedback / Summary
                    </Label>
                    <Textarea
                      id="studio-final-comment"
                      rows={4}
                      value={feedback.finalComment || ''}
                      onChange={(e) =>
                        setFeedback({ ...feedback, finalComment: e.target.value })
                      }
                      disabled={activeInterview.status === 'Completed'}
                      placeholder="Click Auto-Generate Feedback or write custom observations..."
                      className="mt-1 text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ---------------------------------------------------- */}
            {/* RIGHT COLUMN: TECHNICAL EVALUATION MATRIX            */}
            {/* ---------------------------------------------------- */}
            <div className="lg:col-span-7 space-y-4">
              {/* Technical Scorecard Bar */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Technical Score:
                      </span>
                      <span className="text-2xl font-black font-mono text-foreground">
                        {liveStats.percentage}%
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({liveStats.solved} of {liveStats.total} Solved)
                      </span>
                    </div>

                    {/* 3 Count Badges */}
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <Badge className="bg-emerald-600 text-white font-bold text-xs px-2 py-0.5">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> {liveStats.solved} Solved
                      </Badge>
                      <Badge className="bg-amber-600 text-white font-bold text-xs px-2 py-0.5">
                        <MinusCircle className="h-3 w-3 mr-1" /> {liveStats.partial} Partial
                      </Badge>
                      <Badge className="bg-rose-600 text-white font-bold text-xs px-2 py-0.5">
                        <XCircle className="h-3 w-3 mr-1" /> {liveStats.cantSolve} Can&apos;t Solve
                      </Badge>
                    </div>

                    {/* Experience Level Switcher */}
                    <div className="inline-flex rounded-lg border bg-muted p-0.5 text-xs">
                      {(['Fresher', 'Intermediate', 'Experienced'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          disabled={activeInterview.status === 'Completed'}
                          onClick={() => setFeedback({ ...feedback, experienceLevel: lvl })}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            feedback.experienceLevel === lvl
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-black'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all duration-200 rounded-full"
                      style={{ width: `${liveStats.percentage}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Dynamic Technical Topic Sections */}
              <div className="space-y-4">
                {(feedback.technicalEvaluation || []).map((sec) => {
                  const templateForCourse =
                    DEFAULT_COURSE_TEMPLATES[activeInterview.course] ||
                    DEFAULT_COURSE_TEMPLATES['Full Stack Development'];
                  const matchedCat = templateForCourse?.categories.find((c) => c.id === sec.id);
                  const suggestions = matchedCat?.suggestions || [];

                  return (
                    <Card key={sec.id} className="overflow-hidden border-slate-200 dark:border-slate-800">
                      <CardHeader className="bg-muted/30 border-b py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold text-foreground">
                              {sec.label}
                            </CardTitle>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {sec.questions.length} Questions
                            </Badge>
                          </div>

                          {/* Quick question picker dropdown from suggestions */}
                          {activeInterview.status !== 'Completed' && suggestions.length > 0 && (
                            <select
                              aria-label={`Add Question to ${sec.label}`}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddQuestion(sec.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              className="rounded-lg border bg-background px-2 py-1 text-xs font-semibold text-foreground"
                            >
                              <option value="">+ Add Suggested Question</option>
                              {suggestions.map((sugg, i) => (
                                <option key={i} value={sugg}>
                                  {sugg}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-3">
                        {/* Questions List */}
                        {sec.questions.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic text-center py-2">
                            No questions added yet. Select from the dropdown above or type below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {sec.questions.map((q) => {
                              const isSolved = q.status === 'solved';
                              const isPartial = q.status === 'partial';
                              const isCantSolve = q.status === 'cant_solve';

                              return (
                                <div
                                  key={q.id}
                                  className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                                    isSolved
                                      ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800'
                                      : isPartial
                                      ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800'
                                      : isCantSolve
                                      ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-800'
                                      : 'bg-card border-border'
                                  }`}
                                >
                                  <div className="flex-1 pr-2">
                                    <p className="text-xs font-bold text-foreground leading-snug">
                                      {q.text}
                                    </p>
                                  </div>

                                  {/* 3 Status Grading Buttons */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={activeInterview.status === 'Completed'}
                                      onClick={() =>
                                        handleGradeQuestion(sec.id, q.id, 'solved')
                                      }
                                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                        isSolved
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-800'
                                      }`}
                                      title="Mark as Solved"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Solved</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={activeInterview.status === 'Completed'}
                                      onClick={() =>
                                        handleGradeQuestion(sec.id, q.id, 'partial')
                                      }
                                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                        isPartial
                                          ? 'bg-amber-600 text-white shadow-xs'
                                          : 'bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-800'
                                      }`}
                                      title="Mark as Partially Solved"
                                    >
                                      <MinusCircle className="h-3.5 w-3.5" />
                                      <span>Partial</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={activeInterview.status === 'Completed'}
                                      onClick={() =>
                                        handleGradeQuestion(sec.id, q.id, 'cant_solve')
                                      }
                                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                        isCantSolve
                                          ? 'bg-rose-600 text-white shadow-xs'
                                          : 'bg-muted text-muted-foreground hover:bg-rose-100 hover:text-rose-800'
                                      }`}
                                      title="Mark as Can't Solve"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      <span>Can&apos;t Solve</span>
                                    </button>

                                    {activeInterview.status !== 'Completed' && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteQuestion(sec.id, q.id)}
                                        className="text-muted-foreground hover:text-rose-600 p-1 ml-1"
                                        title="Delete Question"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Custom Question Input for this section */}
                        {activeInterview.status !== 'Completed' && (
                          <div className="flex gap-2 pt-1">
                            <Input
                              value={customQuestionInputs[sec.id] || ''}
                              onChange={(e) =>
                                setCustomQuestionInputs({
                                  ...customQuestionInputs,
                                  [sec.id]: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddQuestion(sec.id, customQuestionInputs[sec.id] || '');
                                }
                              }}
                              placeholder={`+ Type custom question for ${sec.label}...`}
                              className="text-xs h-8"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleAddQuestion(sec.id, customQuestionInputs[sec.id] || '')
                              }
                              className="h-8 text-xs font-bold shrink-0"
                            >
                              Add
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Add New Topic Section Box */}
                {activeInterview.status !== 'Completed' && (
                  <div>
                    {showAddSectionBox ? (
                      <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 animate-in fade-in duration-150">
                        <Label className="text-xs font-bold">New Technical Topic Name</Label>
                        <div className="flex gap-2">
                          <Input
                            value={newSectionLabel}
                            onChange={(e) => setNewSectionLabel(e.target.value)}
                            placeholder="e.g. Redux Toolkit, NextAuth, Docker & CI/CD..."
                            className="text-xs h-8"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddNewSection}
                            className="h-8 text-xs font-bold bg-slate-900 text-white shrink-0"
                          >
                            Add Topic
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowAddSectionBox(false)}
                            className="h-8 text-xs shrink-0"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddSectionBox(true)}
                        className="w-full h-9 border-dashed text-xs font-bold text-primary"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add New Topic Section Live
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'studio' && (!activeInterview || !feedback) && (
        <div className="flex h-full min-h-[350px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/20 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
            <Tv className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Active Interview Selected</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Please select a candidate from the Candidate Queue or click &ldquo;Start Interview&rdquo; to launch the live assessment studio.
          </p>
          <Button
            size="sm"
            onClick={() => setActiveView('queue')}
            className="mt-4 text-xs font-bold"
          >
            Go to Candidate Queue
          </Button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: COURSE TEMPLATES & QUESTION BANK                 */}
      {/* ======================================================== */}
      {activeView === 'templates' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Google Doc Importer Banner */}
          <Card className="border-indigo-200 dark:border-indigo-900 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Import Questions from Google Doc
              </CardTitle>
              <CardDescription>
                Provide Google Doc link (`/document/d/...`). System will parse headings and bulleted questions into evaluation templates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImportDocQuestions} className="flex flex-col sm:flex-row gap-2.5">
                <Input
                  value={googleDocUrl}
                  onChange={(e) => setGoogleDocUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/.../edit"
                  className="text-xs font-mono"
                  required
                />
                <Button
                  type="submit"
                  disabled={isImportingDoc}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0"
                >
                  {isImportingDoc ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing Doc...
                    </span>
                  ) : (
                    'Parse & Import Questions'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Default Course Templates Preview */}
          <div className="grid gap-4 md:grid-cols-2">
            {Object.values(DEFAULT_COURSE_TEMPLATES).map((tmpl) => (
              <Card key={tmpl.course} className="overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-foreground">
                      {tmpl.course}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {tmpl.categories.length} Categories
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {tmpl.categories.map((cat) => (
                    <div key={cat.id} className="space-y-1.5 text-xs">
                      <p className="font-bold text-foreground">{cat.label}</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-[11px]">
                        {cat.suggestions.map((q, qIdx) => (
                          <li key={qIdx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: BATCH IMPORT STUDENTS FROM GOOGLE SHEET         */}
      {/* ======================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Batch Import Candidates</h3>
                <p className="text-xs text-muted-foreground">Import candidates via Google Sheet URL or CSV/TSV data</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowImportModal(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold">Google Sheet URL</Label>
                <Input
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Or Paste CSV / TSV Data</Label>
                <Textarea
                  value={pastedCsvInput}
                  onChange={(e) => setPastedCsvInput(e.target.value)}
                  placeholder="Name,Email,Phone,Course,Batch,Slot..."
                  className="mt-1 text-xs font-mono h-24"
                />
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                <p className="font-bold text-foreground">Smart Header Detection:</p>
                <p>Columns are auto-detected: Name, Email, Phone, Course, Batch, Slot.</p>
                <p className="text-emerald-600 font-semibold">
                  Interview sessions (Status: Assigned) are created automatically for each imported student.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportSheet}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Start Import
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD MANUAL CANDIDATE                            */}
      {/* ======================================================== */}
      {showManualStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-foreground">Add Candidate Manually</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowManualStudentModal(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleAddManualStudent} className="space-y-3">
              <div>
                <Label className="text-xs font-bold">Candidate Full Name *</Label>
                <Input
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Arif Hossain"
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Email Address *</Label>
                <Input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="arif@gmail.com"
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Phone Number</Label>
                <Input
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-bold">Course</Label>
                  <select
                    value={newStudentCourse}
                    onChange={(e) => setNewStudentCourse(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="Full Stack Development">Full Stack Development</option>
                    <option value="Frontend Development">Frontend Development</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Batch</Label>
                  <Input
                    value={newStudentBatch}
                    onChange={(e) => setNewStudentBatch(e.target.value)}
                    placeholder="Batch 10"
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Interview Slot</Label>
                <Input
                  value={newStudentSlot}
                  onChange={(e) => setNewStudentSlot(e.target.value)}
                  placeholder="Slot 1: 10:00 AM - 10:20 AM"
                  className="mt-1 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowManualStudentModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-slate-900 text-white font-bold">
                  Save &amp; Assign Interview
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CONFIRM FINAL SUBMIT (SWEETALERT2 STYLE POPUP)   */}
      {/* ======================================================== */}
      {showSubmitConfirmModal && activeInterview && feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  Confirm Final Assessment Submit
                </h3>
                <p className="text-xs text-muted-foreground">{activeInterview.student.name}</p>
              </div>
            </div>

            {/* Quick Summary Preview */}
            <div className="space-y-2.5 text-xs">
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <p className="font-bold text-foreground">Technical Evaluation Breakdown:</p>
                <div className="grid grid-cols-3 gap-1 text-center font-mono">
                  <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800 font-bold dark:bg-emerald-950/60 dark:text-emerald-300">
                    {liveStats.solved} Solved
                  </div>
                  <div className="rounded-lg bg-amber-100 p-1.5 text-amber-800 font-bold dark:bg-amber-950/60 dark:text-amber-300">
                    {liveStats.partial} Partial
                  </div>
                  <div className="rounded-lg bg-rose-100 p-1.5 text-rose-800 font-bold dark:bg-rose-950/60 dark:text-rose-300">
                    {liveStats.cantSolve} Can&apos;t
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Final Recommendation:</span>
                  <strong className="text-foreground">{feedback.finalRecommendation || 'Not selected'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interpersonal Skills:</span>
                  <strong className="text-foreground">{feedback.interpersonalLevel || 'Not rated'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Camera Status:</span>
                  <strong className="text-foreground">{feedback.cameraOn ? 'Camera ON' : 'Camera OFF'}</strong>
                </div>
              </div>

              <p className="text-[11px] text-amber-700 dark:text-amber-300 border-t pt-2">
                ⚠️ Once submitted, the session will lock as &ldquo;Completed&rdquo; and become exportable in 15 columns to Google Sheet.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSubmitConfirmModal(false)}
              >
                Keep Editing
              </Button>
              <Button
                size="sm"
                onClick={handleFinalSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Yes, Submit Final
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: GOOGLE SHEET DIRECT SYNC MODAL                  */}
      {/* ======================================================== */}
      {showSheetSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Sync to Google Sheet</h3>
                <p className="text-xs text-muted-foreground">Write 15 formatted columns directly to your Google Sheet</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowSheetSyncModal(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold">Target Google Sheet URL</Label>
                <Input
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                <p className="font-bold text-foreground">15 Export Columns:</p>
                <p>Student Name, Email, Phone, Course, Slot/Batch, Status, Interpersonal, Language, Camera, Solved, Partial, Can&apos;t Solve, Problem Solving, Recommendation, General Comments।</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowSheetSyncModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSyncToSheet}
                  disabled={isSyncingSheet}
                  className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black font-bold"
                >
                  {isSyncingSheet ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing Rows...
                    </span>
                  ) : (
                    'Write to Google Sheet'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
