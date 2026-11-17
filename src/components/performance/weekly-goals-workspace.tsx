"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarRange,
  CheckCircle2,
  FileLock2,
  Loader2,
  MessageSquareText,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import type { WeeklyGoalsData } from "@/lib/weekly-goals/types";

async function loadWeeklyGoals(): Promise<WeeklyGoalsData> {
  const response = await fetch("/api/weekly-goals", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.message || "Unable to load weekly goals.");
  return payload.data;
}

async function saveWeeklyGoals(goals: string[]) {
  const response = await fetch("/api/weekly-goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goals }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.message || "Unable to submit weekly goals.");
  return payload.data;
}

async function saveNote(submissionId: string, note: string) {
  const response = await fetch("/api/weekly-goals", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submission_id: submissionId, note }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.message || "Unable to add the note.");
  return payload.data;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading weekly goals">
      <div className="h-44 animate-pulse rounded-3xl bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

export function WeeklyGoalsWorkspace() {
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState([""]);
  const [note, setNote] = useState("");
  const query = useQuery({
    queryKey: ["weekly-goals", "current"],
    queryFn: loadWeeklyGoals,
  });
  const submit = useMutation({
    mutationFn: () =>
      saveWeeklyGoals(goals.map((goal) => goal.trim()).filter(Boolean)),
    onSuccess: () => {
      toast.success(
        "Weekly goals submitted. They are now locked for this week.",
      );
      queryClient.invalidateQueries({ queryKey: ["weekly-goals", "current"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const comment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      saveNote(id, body),
    onSuccess: () => {
      setNote("");
      toast.success("Note added.");
      queryClient.invalidateQueries({ queryKey: ["weekly-goals", "current"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data)
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-bold">Weekly goals could not be loaded.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {query.error instanceof Error
              ? query.error.message
              : "Try again shortly."}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );

  const { week, submission } = query.data;
  const canSubmit =
    goals.some((goal) => goal.trim().length >= 3) &&
    goals.every((goal) => !goal.trim() || goal.trim().length >= 3);
  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Programming Hero · Placement Team"
        title="Weekly Goals"
        description="Commit to focused priorities for the current week and keep an accountable record through notes."
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-indigo-200/70 bg-gradient-to-r from-blue-50/80 via-background to-violet-50/80 p-5 shadow-sm dark:border-indigo-900/70 dark:from-blue-950/25 dark:to-violet-950/25 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
            <CalendarRange className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Current reporting week</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Week {week.number}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{dateLabel(week.start)} — {dateLabel(week.end)}</p>
          </div>
        </div>
        <Badge className="w-fit bg-indigo-100 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300">{week.year} · Current week</Badge>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,.88fr)]">
        <Card className="min-w-0 border-indigo-200/70 shadow-sm dark:border-indigo-900/70">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/25 dark:to-violet-950/25">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-indigo-600" />
                  This week’s goals
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {submission
                    ? "Submitted goals are locked until the next week."
                    : "Add as many focused goals as you need before submitting."}
                </p>
              </div>
              {submission ? (
                <Badge className="bg-indigo-600 text-white">
                  <FileLock2 className="mr-1 h-3 w-3" />
                  Locked
                </Badge>
              ) : (
                <Badge variant="outline">Draft</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {submission ? (
              <div className="space-y-3">
                {submission.goals.map((goal, index) => (
                  <div
                    key={`${index}-${goal}`}
                    className="flex gap-3 rounded-2xl border bg-gradient-to-r from-blue-50/80 to-violet-50/80 p-4 dark:from-blue-950/20 dark:to-violet-950/20"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <p className="min-w-0 break-words pt-1 text-sm font-semibold leading-6">
                      {goal}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal, index) => (
                  <div
                    key={index}
                    className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)_36px] items-start gap-2 rounded-2xl border bg-muted/20 p-3"
                  >
                    <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {index + 1}
                    </span>
                    <Textarea
                      aria-label={`Weekly goal ${index + 1}`}
                      value={goal}
                      onChange={(event) =>
                        setGoals((current) =>
                          current.map((item, goalIndex) =>
                            goalIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder="Describe a specific, measurable goal for this week"
                      maxLength={300}
                      className="min-h-20 resize-y bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove goal ${index + 1}`}
                      disabled={goals.length === 1}
                      onClick={() =>
                        setGoals((current) =>
                          current.filter((_, goalIndex) => goalIndex !== index),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl border-dashed text-indigo-700 dark:text-indigo-300"
                  onClick={() => setGoals((current) => [...current, ""])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add new goal
                </Button>
                <Button
                  type="button"
                  className="h-11 w-full bg-indigo-600 font-bold text-white hover:bg-indigo-700"
                  disabled={!canSubmit || submit.isPending}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Submit weekly goals
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Submission is available only for the current week and cannot
                  be edited.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="border-violet-200/70 shadow-sm dark:border-violet-900/70">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-violet-600" />
                Notes & comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {!submission ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Submit your weekly goals to start adding notes.
                </div>
              ) : (
                <>
                  {submission.comments.length ? (
                    <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                      {submission.comments.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border bg-muted/25 p-3"
                        >
                          <p className="break-words text-sm leading-6">
                            {item.body}
                          </p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {item.author_name} ·{" "}
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">
                      No notes added yet.
                    </p>
                  )}
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add context, a blocker, or a follow-up note"
                    maxLength={1000}
                    className="min-h-24"
                  />
                  <Button
                    className="w-full bg-violet-600 text-white hover:bg-violet-700"
                    disabled={note.trim().length < 2 || comment.isPending}
                    onClick={() =>
                      comment.mutate({ id: submission.id, body: note.trim() })
                    }
                  >
                    {comment.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add note
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
