"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarX2,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RHFInput } from "@/components/forms/rhf-fields";
import { PERFORMANCE_PLAN_TYPE } from "@/constants";
import type {
  MonthlyKpiRecord,
  PerformancePlanData,
} from "@/lib/performance/types";
import {
  MentorMonthlyGoalsSchema,
  type MentorMonthlyGoalsInput,
  type MonthlyKpiInput,
} from "@/lib/validators/performance-plan.schema";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";

async function fetchPlans(month?: string): Promise<PerformancePlanData> {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";
  const response = await fetch(`/api/performance-plans${query}`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.message || "Unable to load monthly goals.");
  return payload.data;
}

async function request(
  input: Record<string, unknown>,
  method: "POST" | "PATCH",
) {
  const response = await fetch("/api/performance-plans", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.message || "Unable to save the monthly goal.");
  return payload.data;
}

function monthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function recentMonths(currentMonth: string, count = 12) {
  const [year, month] = currentMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function ManagerMonthlyGoalsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading manager monthly goals">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <div className="h-5 w-52 animate-pulse rounded bg-muted" />
          <div className="h-9 w-36 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-5 w-56 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-10 w-44 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 w-52 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ApprovedGoalsPanel({
  records,
  month,
}: {
  records: MonthlyKpiRecord[];
  month: string;
}) {
  const approved = records.filter(
    (record) => record.approval_status === "approved",
  );
  return (
    <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 via-background to-blue-50 shadow-sm dark:border-violet-900 dark:from-violet-950/25 dark:via-card dark:to-blue-950/15">
      <CardHeader className="border-b border-violet-200/70 dark:border-violet-900/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Active targets
            </p>
            <CardTitle className="mt-1 flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              Approved monthly goals
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-full bg-background/80 px-3 py-1"
          >
            {monthLabel(month)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {approved.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {approved.map((record) => (
              <article
                key={record.id}
                className="relative overflow-hidden rounded-2xl border bg-background/90 p-4 shadow-sm"
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-violet-600" />
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      {record.user_name}
                    </p>
                    <p className="mt-1 break-words text-sm font-bold">
                      {record.title}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 pl-1">
                  <div>
                    <p className="text-3xl font-black tabular-nums text-violet-700 dark:text-violet-300">
                      {record.target_value}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      Target {record.unit}
                    </p>
                  </div>
                  <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                    Approved
                  </Badge>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-background/60 px-6 py-10 text-center dark:border-violet-900">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
              <CalendarX2 className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-lg font-black">
              No approved goals for {monthLabel(month)}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Approved mentor goals will appear here after the review is
              completed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SelfMonthlyForm({
  saving,
  goalExists,
  onSubmit,
}: {
  saving: boolean;
  goalExists: boolean;
  onSubmit: (value: MentorMonthlyGoalsInput) => void;
}) {
  const form = useForm<MentorMonthlyGoalsInput>({
    resolver: zodResolver(MentorMonthlyGoalsSchema),
    defaultValues: {
      month: new Date().toISOString().slice(0, 7),
      goals: [{ agenda: "Monthly placement", target_value: "" }],
    },
  });
  const goals = useFieldArray({ control: form.control, name: "goals" });
  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <RHFInput
          control={form.control}
          name="month"
          label="Goal month"
          type="month"
          readOnly
          required
        />
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2 px-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <span>Goal</span>
            <span>Target</span>
            <span />
          </div>
          {goals.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-[minmax(0,1fr)_110px_36px] items-start gap-2 rounded-xl border bg-muted/20 p-2"
            >
              <RHFInput
                control={form.control}
                name={`goals.${index}.agenda`}
                label="Goal"
                aria-label={`Goal ${index + 1}`}
                placeholder="Monthly placement"
                required
                className="space-y-0 [&_label]:sr-only"
              />
              <RHFInput
                control={form.control}
                name={`goals.${index}.target_value`}
                label="Target"
                aria-label={`Goal ${index + 1} target`}
                inputMode="numeric"
                placeholder="15"
                required
                className="space-y-0 [&_label]:sr-only"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-10 w-9 text-muted-foreground hover:text-violet-700 dark:hover:text-violet-300"
                disabled={goals.fields.length === 1}
                onClick={() => goals.remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl border-dashed"
            disabled
            onClick={() => goals.append({ agenda: "", target_value: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add another goal
          </Button>
        </div>
        <Button
          type="submit"
          className="h-11 w-full bg-violet-600 font-bold hover:bg-violet-700"
          disabled={saving || goalExists}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit
        </Button>
      </form>
    </Form>
  );
}

function GoalActions({
  record,
  teamView,
  saving,
  onRevise,
  onApprove,
  onComment,
}: {
  record: MonthlyKpiRecord;
  teamView: boolean;
  saving: boolean;
  onRevise: (input: {
    id: string;
    agenda: string;
    target_value: string;
    notes: string;
  }) => void;
  onApprove: (id: string) => void;
  onComment: (id: string, managerNote: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "comment">("idle");
  const [agenda, setAgenda] = useState(record.title);
  const [target, setTarget] = useState(String(record.target_value));
  const [notes, setNotes] = useState(record.notes);
  const [managerNote, setManagerNote] = useState(record.manager_note);
  useEffect(() => {
    setAgenda(record.title);
    setTarget(String(record.target_value));
    setNotes(record.notes);
    setManagerNote(record.manager_note);
    if (record.approval_status === "approved") setMode("idle");
  }, [record]);

  if (mode === "edit")
    return (
      <div className="grid min-w-0 gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Goal
          </span>
          <input
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
            placeholder="Goal"
            className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        <label className="min-w-0 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Target
          </span>
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            inputMode="numeric"
            placeholder="Target"
            className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        <label className="min-w-0 space-y-1.5 sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Mentor note
          </span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional note"
            className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2">
          <Button
            className="w-full whitespace-nowrap"
            size="sm"
            variant="outline"
            onClick={() => setMode("idle")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="w-full whitespace-nowrap"
            size="sm"
            onClick={() => {
              onRevise({ id: record.id, agenda, target_value: target, notes });
              setMode("idle");
            }}
            disabled={saving}
          >
            Save & resubmit
          </Button>
        </div>
      </div>
    );
  if (mode === "comment")
    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            Manager comment
          </span>
          <input
            value={managerNote}
            onChange={(event) => setManagerNote(event.target.value)}
            placeholder="What should the mentor change?"
            className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Button
            className="w-full whitespace-nowrap"
            size="sm"
            variant="outline"
            onClick={() => setMode("idle")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="w-full whitespace-nowrap"
            size="sm"
            onClick={() => {
              onComment(record.id, managerNote);
              setMode("idle");
            }}
            disabled={saving || managerNote.trim().length < 2}
          >
            Send comment
          </Button>
        </div>
      </div>
    );
  if (teamView)
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onApprove(record.id)}
          disabled={saving || record.approval_status === "approved"}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          {record.approval_status === "approved" ? "Approved" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode("comment")}
          disabled={saving || record.approval_status === "approved"}
        >
          <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
          Comment / request changes
        </Button>
      </div>
    );
  if (record.approval_status === "approved") return null;
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setMode("edit")}
      disabled={saving}
    >
      <Pencil className="mr-1.5 h-3.5 w-3.5" />
      Edit and resubmit
    </Button>
  );
}

export function MonthlyGoalsWorkspace({
  view = "auto",
}: {
  view?: "auto" | "team" | "self";
}) {
  const queryClient = useQueryClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMentor, setSelectedMentor] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const requestedMonth = view === "team" ? selectedMonth : undefined;
  const plans = useQuery({
    queryKey: ["performance-plans", requestedMonth ?? "all"],
    queryFn: () => fetchPlans(requestedMonth),
    retry: false,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["performance-plans"] });
  const createMutation = useMutation({
    mutationFn: async (value: MentorMonthlyGoalsInput) =>
      Promise.all(
        value.goals.map((goal) =>
          request(
            {
              type: PERFORMANCE_PLAN_TYPE.MONTHLY_KPI,
              month: value.month,
              mentor_id: "",
              mentor_email: "",
              mentor_name: "",
              agenda: goal.agenda,
              target_value: goal.target_value,
              notes: "",
            } satisfies MonthlyKpiInput,
            "POST",
          ),
        ),
      ),
    onSuccess: async () => {
      await refresh();
      toast.success("Monthly goals submitted for manager approval.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reviseMutation = useMutation({
    mutationFn: (value: {
      id: string;
      agenda: string;
      target_value: string;
      notes: string;
    }) => request(value, "PATCH"),
    onSuccess: async () => {
      await refresh();
      toast.success("Goal updated and returned to pending.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      request({ id, approval_status: "approved" }, "PATCH"),
    onSuccess: async () => {
      await refresh();
      toast.success("Monthly goal approved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const commentMutation = useMutation({
    mutationFn: ({ id, manager_note }: { id: string; manager_note: string }) =>
      request({ id, review_action: "comment", manager_note }, "PATCH"),
    onSuccess: async () => {
      await refresh();
      toast.success("Comment sent to the mentor.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const records = plans.data?.monthlyKpis ?? [];
  const teamView =
    view === "team" || (view === "auto" && plans.data?.scope === "team");
  const visibleRecords = records.filter(
    (record) =>
      record.month === (teamView ? selectedMonth : currentMonth) &&
      (selectedMentor === "all" || record.user_id === selectedMentor),
  );
  const currentMonthGoalExists = !teamView && visibleRecords.length > 0;
  const months = Array.from(
    new Set([
      ...recentMonths(currentMonth),
      selectedMonth,
      ...records.map((record) => record.month),
    ]),
  )
    .sort()
    .reverse();
  const pendingCount = visibleRecords.filter(
    (record) => record.approval_status === "pending",
  ).length;
  const approvedCount = visibleRecords.filter(
    (record) => record.approval_status === "approved",
  ).length;
  const saving =
    createMutation.isPending ||
    reviseMutation.isPending ||
    approveMutation.isPending ||
    commentMutation.isPending;

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 pb-10">
      <DashboardPageHeader
        eyebrow="Programming Hero · Performance Workspace"
        title="Monthly Goals"
        description="Mentors submit monthly goals, managers review or request changes, and approved targets are tracked here."
      />

      {teamView && plans.isLoading ? (
        <ManagerMonthlyGoalsSkeleton />
      ) : (
        <>
          {teamView && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                      Visible goals
                    </p>
                    <p className="mt-1 text-2xl font-black">
                      {visibleRecords.length}
                    </p>
                  </div>
                  <Target className="h-6 w-6 text-violet-600" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                      Pending
                    </p>
                    <p className="mt-1 text-2xl font-black">{pendingCount}</p>
                  </div>
                  <Clock3 className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                      Approved
                    </p>
                    <p className="mt-1 text-2xl font-black">{approvedCount}</p>
                  </div>
                  <Check className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </CardContent>
              </Card>
            </div>
          )}

          {teamView && !plans.isError && (
            <ApprovedGoalsPanel
              records={visibleRecords}
              month={selectedMonth}
            />
          )}

          <div
            className={`grid items-start gap-6 ${teamView ? "" : "xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]"}`}
          >
            <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
              <CardHeader className="border-b bg-muted/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-lg">
                        {teamView
                          ? "Monthly goal approvals"
                          : "My monthly goals"}
                      </CardTitle>
                      <Badge variant="secondary" className="rounded-full">
                        {visibleRecords.length} total
                      </Badge>
                    </div>
                    {teamView && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Review mentor targets, approve submissions, or request
                        focused changes.
                      </p>
                    )}
                  </div>
                  {teamView && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label className="grid gap-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                          Goal month
                        </span>
                        <select
                          value={selectedMonth}
                          onChange={(event) => {
                            setSelectedMonth(event.target.value);
                            setSelectedMentor("all");
                          }}
                          className="h-10 min-w-44 rounded-xl border bg-background px-3 text-sm font-semibold"
                        >
                          {months.map((month) => (
                            <option key={month} value={month}>
                              {monthLabel(month)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                          Mentor
                        </span>
                        <select
                          value={selectedMentor}
                          onChange={(event) =>
                            setSelectedMentor(event.target.value)
                          }
                          className="h-10 min-w-52 rounded-xl border bg-background px-3 text-sm font-semibold"
                        >
                          <option value="all">All mentors</option>
                          {plans.data?.mentors.map((mentor) => (
                            <option key={mentor.id} value={mentor.id}>
                              {mentor.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className={teamView ? "p-4 sm:p-5" : "p-0"}>
                {plans.isLoading ? (
                  <div className="space-y-3 p-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-28 animate-pulse rounded-2xl bg-muted"
                      />
                    ))}
                  </div>
                ) : plans.isError ? (
                  <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-violet-700 dark:text-violet-300">
                    <CalendarX2 className="h-10 w-10 opacity-50" />
                    <h2 className="mt-4 font-black">
                      Monthly goals are unavailable
                    </h2>
                    <p className="mt-2 text-sm">
                      {plans.error instanceof Error
                        ? plans.error.message
                        : "Unable to load goals."}
                    </p>
                  </div>
                ) : visibleRecords.length === 0 ? (
                  <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-gradient-to-br from-violet-50/70 via-background to-blue-50/60 p-8 text-center dark:from-violet-950/20 dark:to-blue-950/10">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-sm dark:bg-violet-950/60 dark:text-violet-300">
                      <Sparkles className="h-8 w-8" />
                    </span>
                    <h2 className="mt-5 text-xl font-black">
                      No goals for{" "}
                      {monthLabel(teamView ? selectedMonth : currentMonth)}
                    </h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {teamView
                        ? selectedMentor === "all"
                          ? "No mentor has submitted goals for this month yet. Choose another month or check back after submissions arrive."
                          : "This mentor has no goals for the selected month. Try viewing all mentors or choose another month."
                        : "Set up a new goal for this month."}
                    </p>
                  </div>
                ) : teamView ? (
                  <div className="grid items-stretch gap-4 lg:grid-cols-2">
                    {visibleRecords.map((record) => (
                      <article
                        key={record.id}
                        className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div
                          className={`absolute inset-x-0 top-0 h-1 ${record.approval_status === "approved" ? "bg-blue-500" : record.manager_note ? "bg-indigo-500" : "bg-violet-500"}`}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-4">
                          <div className="flex min-w-0 items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  <CalendarDays className="mr-1 h-3 w-3" />
                                  {monthLabel(record.month)}
                                </Badge>
                                <Badge
                                  variant={
                                    record.approval_status === "approved"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {record.approval_status === "approved"
                                    ? "Approved"
                                    : record.manager_note
                                      ? "Changes requested"
                                      : "Pending review"}
                                </Badge>
                              </div>
                              <h2 className="mt-4 break-words text-base font-black">
                                {record.user_name}
                              </h2>
                              <p className="mt-1 break-words text-sm font-semibold text-muted-foreground">
                                {record.title}
                              </p>
                            </div>
                            <div className="shrink-0 rounded-2xl bg-violet-50 px-5 py-3 text-center dark:bg-violet-950/30">
                              <p className="text-2xl font-black text-violet-700 dark:text-violet-300">
                                {record.target_value}
                              </p>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                Target
                              </p>
                            </div>
                          </div>
                          {record.manager_note && (
                            <div className="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
                              <p className="text-[10px] font-black uppercase tracking-wider">
                                Manager comment
                              </p>
                              <p className="mt-1 break-words">
                                {record.manager_note}
                              </p>
                            </div>
                          )}
                          <div className="mt-auto border-t pt-4">
                            <GoalActions
                              record={record}
                              teamView
                              saving={saving}
                              onRevise={(value) => reviseMutation.mutate(value)}
                              onApprove={(id) => approveMutation.mutate(id)}
                              onComment={(id, manager_note) =>
                                commentMutation.mutate({ id, manager_note })
                              }
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {visibleRecords.map((record) => (
                      <article key={record.id} className="min-w-0 p-4 sm:p-5">
                        <div className="flex min-w-0 flex-col gap-4">
                          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">
                                  <CalendarDays className="mr-1 h-3 w-3" />
                                  {monthLabel(record.month)}
                                </Badge>
                                <Badge
                                  variant={
                                    record.approval_status === "approved"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {record.approval_status === "approved"
                                    ? "Approved"
                                    : record.manager_note
                                      ? "Changes requested"
                                      : "Pending review"}
                                </Badge>
                              </div>
                              <p className="mt-3 break-words text-sm font-semibold">
                                {record.title}
                              </p>
                            </div>
                            <div className="w-full shrink-0 rounded-xl bg-violet-50 px-5 py-3 text-center dark:bg-violet-950/30 sm:w-auto">
                              <p className="text-2xl font-black text-violet-700 dark:text-violet-300">
                                {record.target_value}
                              </p>
                              <p className="text-[9px] font-bold uppercase text-muted-foreground">
                                Target
                              </p>
                            </div>
                          </div>
                          {record.manager_note && (
                            <div className="min-w-0 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
                              <p className="text-[10px] font-black uppercase tracking-wider">
                                Manager comment
                              </p>
                              <p className="mt-1 break-words">
                                {record.manager_note}
                              </p>
                            </div>
                          )}
                          <GoalActions
                            record={record}
                            teamView={false}
                            saving={saving}
                            onRevise={(value) => reviseMutation.mutate(value)}
                            onApprove={(id) => approveMutation.mutate(id)}
                            onComment={(id, manager_note) =>
                              commentMutation.mutate({ id, manager_note })
                            }
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {!teamView && (
              <Card className="border-0 shadow-sm ring-1 ring-border xl:sticky xl:top-24">
                <CardHeader className="border-b">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
                    New submission
                  </p>
                  <CardTitle className="text-lg">Add monthly goal</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <SelfMonthlyForm
                    saving={createMutation.isPending}
                    goalExists={plans.isLoading || currentMonthGoalExists}
                    onSubmit={(value) => createMutation.mutate(value)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
