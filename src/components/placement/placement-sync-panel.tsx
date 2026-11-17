"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfMonth } from "date-fns";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlacementDateRangePicker } from "@/components/placement/placement-date-range-picker";
import { PlacementMonthSelect } from "@/components/placement-analytics/placement-month-select";
import { usePlacementAnalytics } from "@/components/placement-analytics/use-placement-analytics";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { formatPlacementMonth } from "@/lib/placement-analytics/analyze";
import type {
  PlacementSyncCounters,
  PlacementSyncRequest,
  PlacementSyncRecord,
  PlacementSyncStatus,
} from "@/lib/placement-sync/types";
import {
  PlacementSyncPageSchema,
  PlacementSyncSchema,
  PlacementSyncStatusSchema,
} from "@/lib/validators/placement-sync.schema";
import { cn } from "@/lib/utils";
import { isRehiredPlacement } from "@/lib/placement-sync/classification";

const emptyCounters: PlacementSyncCounters = {
  fetched: 0,
  inserted: 0,
  updated: 0,
  unchanged: 0,
  invalid: 0,
  ignored: 0,
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PlacementCalendarSkeleton() {
  return (
    <div
      aria-label="Loading placement calendar"
      className="overflow-hidden p-4"
    >
      <div className="min-w-[52rem] animate-pulse">
        <div className="mb-2 grid grid-cols-7 gap-2">
          {weekdays.map((weekday) => (
            <div
              key={weekday}
              className="mx-auto h-3 w-8 rounded-full bg-slate-300 dark:bg-slate-700"
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border border-slate-300/70 bg-slate-200/80 p-3 dark:border-slate-700 dark:bg-slate-800/80"
            >
              <div className="h-3 w-5 rounded-full bg-slate-400/70 dark:bg-slate-600" />
              {index % 3 === 0 && (
                <div className="mt-5 h-2 w-2/3 rounded-full bg-slate-400/50 dark:bg-slate-600/80" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function recordDate(record: PlacementSyncRecord) {
  const timestamp = Date.parse(record.posted_at);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(timestamp))
    : record.posted_at.slice(0, 10);
}

function recentPlacementType(record: PlacementSyncRecord) {
  return isRehiredPlacement(record.job_type, record.position)
    ? "Rehired"
    : "Fresh";
}

async function requestPlacement(
  method: string,
  signal?: AbortSignal,
  payload?: unknown,
  year?: number,
) {
  const requestBody = payload ? JSON.stringify(payload) : undefined;
  const request = () =>
    fetch(`/api/placement-sync${year ? `?year=${year}` : ""}`, {
      method,
      signal,
      cache: method === "GET" ? "default" : "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...(requestBody ? { body: requestBody } : {}),
    });
  let response = await request();
  if (response.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (refreshed.ok) response = await request();
  }
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      (body.message || "The placement request failed.") +
        (typeof body.retryAfter === "number"
          ? ` Wait at least ${body.retryAfter} seconds.`
          : ""),
    );
  return body;
}

function readCachedStatus(year: number) {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = PlacementSyncStatusSchema.safeParse(
      JSON.parse(
        sessionStorage.getItem(`placementhq:placement-status:v2:${year}`) ||
          "null",
      ),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function PlacementSyncPanel() {
  const queryClient = useQueryClient();
  const today = dhakaToday();
  const [fromDate, setFromDate] = useState(() =>
    format(startOfMonth(parseISO(today)), "yyyy-MM-dd"),
  );
  const [toDate, setToDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [recordWindow, setRecordWindow] = useState<"today" | "7days" | "month">(
    "7days",
  );
  const selectedYear = Number(fromDate.slice(0, 4));
  const [busy, setBusy] = useState<"sync" | "test" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [counters, setCounters] =
    useState<PlacementSyncCounters>(emptyCounters);
  const [pending, setPending] = useState<PlacementSyncRequest | null>(null);
  const controller = useRef<AbortController | null>(null);
  const analytics = usePlacementAnalytics();
  const statusQuery = useQuery({
    queryKey: ["placement-sync-status", selectedYear],
    queryFn: async ({ signal }) => {
      const value = PlacementSyncStatusSchema.parse(
        await requestPlacement("GET", signal, undefined, selectedYear),
      );
      try {
        sessionStorage.setItem(
          `placementhq:placement-status:v2:${selectedYear}`,
          JSON.stringify(value),
        );
      } catch {}
      return value;
    },
    initialData: () => readCachedStatus(selectedYear),
    initialDataUpdatedAt: 0,
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const status = statusQuery.data;
  const demo = status?.missingProperties.includes("DEMO_MODE");
  const analysis = analytics.analysis;

  useEffect(() => () => controller.current?.abort(), []);

  const recentRecords = useMemo(() => {
    const start =
      recordWindow === "today"
        ? today
        : recordWindow === "7days"
          ? format(addDays(parseISO(today), -6), "yyyy-MM-dd")
          : format(startOfMonth(parseISO(today)), "yyyy-MM-dd");
    return (status?.recentRecords ?? []).filter(
      (record) => recordDate(record) >= start && recordDate(record) <= today,
    );
  }, [recordWindow, status?.recentRecords, today]);

  function applyPreset(preset: "today" | "7days" | "month" | "30days") {
    const current = parseISO(today);
    const from =
      preset === "today"
        ? current
        : preset === "7days"
          ? addDays(current, -6)
          : preset === "30days"
            ? addDays(current, -29)
            : startOfMonth(current);
    setFromDate(format(from, "yyyy-MM-dd"));
    setToDate(today);
    setPending(null);
    setError("");
  }

  async function testConnection() {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy("test");
    setError("");
    setNotice("");
    try {
      const result = await requestPlacement(
        "PATCH",
        current.signal,
        undefined,
        selectedYear,
      );
      queryClient.setQueryData(
        ["placement-sync-status", selectedYear],
        (previous: PlacementSyncStatus | undefined) =>
          previous
            ? { ...previous, ...result.status }
            : {
                ...result.status,
                sheetsReady: result.status.connectionReady,
                missingProperties: [],
                spreadsheetTitle: null,
                spreadsheetUrl: null,
                masterRows: 0,
                months: [],
                recentRecords: [],
                lastSync: null,
              },
      );
      setNotice(result.message || "Connections checked.");
    } catch (failure) {
      if (!current.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : "Discord test failed.",
        );
    } finally {
      controller.current = null;
      if (!current.signal.aborted) setBusy(null);
    }
  }

  async function sync(resume: boolean) {
    if (controller.current) return;
    const input = PlacementSyncSchema.safeParse(
      resume && pending
        ? pending
        : { fromDate, toDate, runId: crypto.randomUUID() },
    );
    if (!input.success) {
      setError(input.error.issues.map((issue) => issue.message).join(". "));
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setBusy("sync");
    setError("");
    setNotice("");
    if (!resume) setCounters(emptyCounters);
    let next: PlacementSyncRequest = input.data;
    setPending(next);
    let completedPages = resume ? 1 : 0;
    try {
      while (!current.signal.aborted) {
        const result = PlacementSyncPageSchema.parse(
          await requestPlacement("POST", current.signal, next),
        );
        completedPages += 1;
        setCounters((previous) => ({
          fetched: previous.fetched + result.fetched,
          inserted: previous.inserted + result.inserted,
          updated: previous.updated + result.updated,
          unchanged: previous.unchanged + result.unchanged,
          invalid: previous.invalid + result.invalid,
          ignored: previous.ignored + result.ignored,
        }));
        if (result.complete) {
          setPending(null);
          setNotice("Placement sync completed successfully.");
          break;
        }
        next = { ...next, cursor: result.nextCursor! };
        setPending(next);
      }
    } catch (failure) {
      if (!current.signal.aborted) {
        if (completedPages === 0) setPending(null);
        setError(failure instanceof Error ? failure.message : "Sync failed.");
      }
    } finally {
      controller.current = null;
      if (!current.signal.aborted) {
        setBusy(null);
        await Promise.all([statusQuery.refetch(), analytics.refetch()]);
      }
    }
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-10">
      <DashboardPageHeader eyebrow="Programming Hero · Placement Operations" title="Placement Workspace" description="Track monthly outcomes, review recent placements, and sync Discord records." />

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200"
        >
          {notice}
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]">
        <main className="min-w-0">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">
                  Monthly placement tracker
                </h2>
                <p className="text-xs text-muted-foreground">
                  {analysis
                    ? `${analysis.totalPlacements} placements · ${analysis.activeDays} active days`
                    : "Loading placement activity…"}
                </p>
              </div>
              {analytics.data && (
                <PlacementMonthSelect
                  value={analytics.month}
                  months={analytics.data.availableMonths}
                  onChange={analytics.setMonth}
                  disabled={analytics.isFetching}
                />
              )}
            </div>
            {analytics.isPending ? (
              <PlacementCalendarSkeleton />
            ) : (
              analysis && (
                <div className="overflow-x-auto p-4">
                  <div className="min-w-[52rem]">
                    <div className="mb-2 grid grid-cols-7 gap-2">
                      {weekdays.map((weekday) => (
                        <div
                          key={weekday}
                          className="text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground"
                        >
                          {weekday}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from(
                        { length: analysis.startWeekday },
                        (_, index) => (
                          <div
                            key={`empty-${index}`}
                            className="h-24 rounded-xl bg-muted/10"
                          />
                        ),
                      )}
                      {analysis.days.map((day) => (
                        <article
                          key={day.date}
                          aria-label={`${day.date}: ${day.total} placements`}
                          className={cn(
                            "h-24 rounded-xl border p-2.5",
                            day.total
                              ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:border-violet-900 dark:from-violet-950/35 dark:to-card"
                              : "bg-muted/15",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-black text-muted-foreground">
                              {day.day}
                            </span>
                            {day.total > 0 && (
                              <span className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-black text-white">
                                {day.total}
                              </span>
                            )}
                          </div>
                          {day.total > 0 && (
                            <div className="mt-2 space-y-1">
                              {day.mentors.slice(0, 2).map((mentor) => (
                                <p
                                  key={mentor.id}
                                  className="truncate text-[9px] font-bold"
                                >
                                  {mentor.name} · {mentor.count}
                                </p>
                              ))}
                              {day.mentors.length > 2 && (
                                <p className="text-[9px] text-muted-foreground">
                                  +{day.mentors.length - 2} more
                                </p>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-5">
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-black">Connections</h2>
              {status?.spreadsheetUrl && (
                <a
                  href={status.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open placement workbook"
                  className="text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {statusQuery.isPending ? (
              <div className="mt-4 space-y-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-10 animate-pulse rounded-xl bg-slate-300/90 dark:bg-slate-700"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {[
                  {
                    label: "Google Sheets",
                    ready: status?.connectionReady,
                    text: status?.connectionReady ? "Connected" : "Unavailable",
                    icon: FileSpreadsheet,
                  },
                  {
                    label: "Discord",
                    ready: status?.discordConfigured,
                    text: status?.discordConfigured
                      ? "Connected"
                      : "Unavailable",
                    icon: ShieldCheck,
                  },
                  {
                    label: "Sync engine",
                    ready: status?.syncSupported === true,
                    text:
                      status?.syncSupported === false
                        ? "Update required"
                        : status?.syncSupported === true
                          ? "Ready"
                          : "Checking",
                    icon: RefreshCw,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs"
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <item.icon className="h-3.5 w-3.5 text-primary" />
                      {item.label}
                    </span>
                    <span
                      className={
                        item.ready
                          ? "font-bold text-emerald-600"
                          : item.text === "Update required"
                            ? "font-bold text-amber-600"
                            : "text-muted-foreground"
                      }
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="mt-3 w-full"
              variant="ghost"
              disabled={Boolean(busy) || demo}
              onClick={() => void testConnection()}
            >
              {busy === "test" ? "Testing…" : "Test connections"}
            </Button>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/80 to-card p-4 shadow-sm dark:border-violet-900 dark:from-violet-950/25">
            <h2 className="flex items-center gap-2 font-black">
              <CalendarDays className="h-4 w-4 text-primary" /> Sync date range
            </h2>
            <button
              type="button"
              aria-label="Choose sync date range"
              disabled={Boolean(busy) || Boolean(pending)}
              onClick={() => setCalendarOpen(true)}
              className="mt-4 w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:opacity-50"
            >
              <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Selected dates
              </span>
              <span className="mt-2 block text-sm font-black">
                {fromDate
                  ? format(parseISO(fromDate), "d MMM yyyy")
                  : "Choose start date"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                to{" "}
                {toDate
                  ? format(parseISO(toDate), "d MMM yyyy")
                  : "choose end date"}
              </span>
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ["today", "Today"],
                  ["7days", "Past 7 days"],
                  ["month", "This month"],
                  ["30days", "Past 30 days"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={Boolean(busy) || Boolean(pending)}
                  onClick={() => applyPreset(value)}
                  className="rounded-xl border bg-card px-2 py-2 text-[11px] font-bold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-violet-100/70 px-3 py-2 text-[10px] font-semibold leading-4 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              After discord posts sync, the placement data will update
              automatically.
            </p>
            <Button
              aria-label={pending ? "Resume sync" : "Sync to sheet"}
              className="mt-4 w-full bg-violet-600 text-white hover:bg-violet-700"
              disabled={
                Boolean(busy) ||
                Boolean(demo) ||
                (!pending && (!fromDate || !toDate))
              }
              onClick={() => void sync(Boolean(pending))}
            >
              <RefreshCw className={busy === "sync" ? "animate-spin" : ""} />
              {busy === "sync"
                ? "Syncing…"
                : pending
                  ? "Resume sync"
                  : "Sync / resync now"}
            </Button>
            {pending && !busy && (
              <Button
                className="mt-2 w-full"
                variant="outline"
                onClick={() => {
                  setPending(null);
                  setError("");
                }}
              >
                Choose another range
              </Button>
            )}
            {Object.values(counters).some(Boolean) && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(
                  [
                    ["inserted", counters.inserted],
                    ["updated", counters.updated],
                    ["review", counters.invalid],
                  ] as const
                ).map(([label, count]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-card p-2 text-center"
                  >
                    <p className="font-black">{count}</p>
                    <p className="text-[9px] capitalize text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-4">
            {statusQuery.isPending ? (
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
                <div className="h-3 w-28 animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-sm font-black">
                    {status?.masterRows || 0} placements this month
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {status?.spreadsheetTitle ||
                    `Placement Management ${selectedYear}`}
                </p>
              </>
            )}
          </section>
        </aside>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black">Recent placements</h2>
            <p className="text-xs text-muted-foreground">
              {statusQuery.isPending
                ? "Loading records…"
                : `${recentRecords.length} records in the selected view`}
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-muted p-1">
            {(
              [
                ["today", "Today"],
                ["7days", "Last 7 days"],
                ["month", "This month"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRecordWindow(value)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-bold transition",
                  recordWindow === value
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-muted/35 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {[
                  "Date",
                  "Candidate",
                  "Company & role",
                  "Batch",
                  "Mentor",
                  "Status",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-black">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusQuery.isPending
                ? [1, 2, 3, 4].map((row) => (
                    <tr key={row} className="border-t">
                      {[1, 2, 3, 4, 5, 6].map((cell) => (
                        <td key={cell} className="px-4 py-4">
                          <div className="h-8 animate-pulse rounded-lg bg-slate-300/90 dark:bg-slate-700" />
                        </td>
                      ))}
                    </tr>
                  ))
                : recentRecords.map((record) => {
                    const type = recentPlacementType(record);
                    return (
                      <tr
                        key={record.discord_message_id}
                        className="border-t hover:bg-muted/25"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-xs font-bold">
                          {recordDate(record)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold">
                            {record.candidate_name || "Missing name"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {record.candidate_email}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold">
                            {record.company_name || "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {record.position ||
                              record.job_type ||
                              "Role not specified"}
                          </p>
                        </td>
                        <td className="px-4 py-4">{record.batch || "—"}</td>
                        <td className="px-4 py-4">
                          {record.mentor_name || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[10px] font-bold",
                              type === "Rehired"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                            )}
                          >
                            {type}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!statusQuery.isPending && !recentRecords.length && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No placements found for this period.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-black">
              <Building2 className="h-4 w-4 text-primary" /> Company placement
              details
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {analysis
                ? formatPlacementMonth(analysis.selectedMonth)
                : "Reporting month"}
            </p>
          </div>
          <span className="text-sm font-black">
            {analysis?.companies.length || 0} companies
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {analytics.isPending
            ? [1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-xl bg-slate-300/90 dark:bg-slate-700"
                />
              ))
            : analysis?.companies.slice(0, 12).map((company, index) => (
                <div key={company.name} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-bold">
                      {index + 1}. {company.name}
                    </span>
                    <span className="text-sm font-black">{company.count}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500"
                      style={{ width: `${Math.max(4, company.share)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {company.share}% of monthly placements
                  </p>
                </div>
              ))}
          {!analytics.isPending && analysis && !analysis.companies.length && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No company placement data this month.
            </p>
          )}
        </div>
      </section>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-5 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select placement dates</DialogTitle>
            <DialogDescription>
              Choose a start and end date, then apply the range for
              synchronization.
            </DialogDescription>
          </DialogHeader>
          <PlacementDateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            today={today}
            disabled={Boolean(busy) || Boolean(pending)}
            onChange={(from, through) => {
              setFromDate(from);
              setToDate(through);
            }}
          />
          <div className="flex justify-end">
            <Button
              disabled={!fromDate || !toDate}
              onClick={() => setCalendarOpen(false)}
            >
              Use selected range
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
