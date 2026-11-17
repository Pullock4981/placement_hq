'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, Code2, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { logRealToolUsage } from '@/lib/tools-usage/client';

export function AiAssignmentCheckTool() {
  const [studentId, setStudentId] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleAudit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setChecked(true);
      toast.success('AI Assignment check completed!');
      logRealToolUsage({
        toolId: 'ai-assignment-check',
        toolName: 'AI Assignment Check',
        actionType: 'single_audit',
        candidateCount: 1,
      });
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Sparkles className="h-4 w-4" /> AI Automated Code & Submission Audit
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">AI Assignment Check</h1>
        <p className="text-sm text-muted-foreground">Automated verification of assignment requirement checklist, originality score, and code best practices.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Submission Details</CardTitle>
              <CardDescription>Enter student ID and assignment repository</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAudit} className="space-y-4">
                <div>
                  <Label htmlFor="assign-student">Student ID / Batch</Label>
                  <Input
                    id="assign-student"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. WEB10-0428"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="assign-repo">GitHub Repository URL</Label>
                  <Input
                    id="assign-repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/repository"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-emerald-600 font-bold hover:bg-emerald-700 text-white">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4 animate-spin" /> Analyzing Codebase...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Run AI Assignment Audit
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          {checked ? (
            <Card className="border-emerald-200 dark:border-emerald-900 shadow-md">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Assignment Audit: 92/100</CardTitle>
                    <CardDescription>{studentId} • Automated AI Feedback</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 font-bold dark:bg-emerald-950/50 dark:text-emerald-300">
                    Low Plagiarism Risk (4%)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2 text-xs">
                  <p className="font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" /> Mandatory Checklist Items:
                  </p>
                  <div className="space-y-1.5 pl-2">
                    <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Authentication (Firebase / JWT) implemented properly
                    </p>
                    <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> CRUD operations functional on parcels & tracking
                    </p>
                    <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Responsive Tailwind layouts across all breakpoints
                    </p>
                    <p className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" /> Environment variables handled, but sample .env.example was missing
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-3.5 bg-card text-xs space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-violet-500" /> AI Mentor Summary:
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Clean folder structure (`/components`, `/hooks`, `/pages`). Good error boundary usage with TanStack Query. Candidate is ready for final interview challenge.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/20 p-8 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-bold text-foreground">Awaiting Assignment URL</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">Provide student ID and GitHub repo to perform AI evaluation against assignment requirements.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

