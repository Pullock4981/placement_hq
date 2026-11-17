'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Wrench,
  BarChart2,
  Users,
  Search,
  RefreshCw,
  PlayCircle,
  FileCheck,
  Globe,
  Sparkles,
  Tv,
  Award,
  Layers,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { ToolUsageSummary } from '@/lib/tools-usage/types';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

export default function AdminToolsViewPage() {
  const [summary, setSummary] = useState<ToolUsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [selectedToolFilter, setSelectedToolFilter] = useState('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/tools-usage', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.success) {
        setSummary(json.data);
      } else {
        toast.error('Failed to load tools usage data.');
      }
    } catch {
      toast.error('Network error loading tools usage.');
    } finally {
      setIsLoading(false);
    }
  };

  const getToolIcon = (toolId: string) => {
    switch (toolId) {
      case 'ats-resume-check':
        return <FileCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />;
      case 'portfolio-check':
        return <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case 'github-profile-check':
        return <GithubIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'resume-screening':
        return <PlayCircle className="h-5 w-5 text-sky-600 dark:text-sky-400" />;
      case 'nexview-tool':
        return <Tv className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case 'ai-assignment-check':
        return <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Wrench className="h-5 w-5 text-violet-600" />;
    }
  };

  // Recharts Data for the Single Chart
  const chartData = useMemo(() => {
    if (!summary?.toolStats) return [];
    return summary.toolStats.map((t) => ({
      name: t.toolName.replace('(60 Marks)', '').replace('Engine', '').replace('Tool', '').trim(),
      fullName: t.toolName,
      'Single Audit': t.singleCount,
      'Batch Audit': t.batchCount,
      Total: t.totalUsage,
      candidates: t.candidatesAudited,
    }));
  }, [summary]);

  // Filtered Users Table
  const filteredUsers = useMemo(() => {
    if (!summary?.userStats) return [];
    return summary.userStats.filter((u) => {
      const matchesSearch =
        u.userName.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.userEmail.toLowerCase().includes(searchUser.toLowerCase());

      const matchesRole =
        selectedRoleFilter === 'all' || u.userRole.toLowerCase() === selectedRoleFilter.toLowerCase();

      const matchesTool =
        selectedToolFilter === 'all' ||
        Object.keys(u.toolBreakdown).some(
          (tName) =>
            tName.toLowerCase().includes(selectedToolFilter.toLowerCase()) &&
            (u.toolBreakdown[tName] || 0) > 0,
        );

      return matchesSearch && matchesRole && matchesTool;
    });
  }, [summary, searchUser, selectedRoleFilter, selectedToolFilter]);

  const formatDate = (iso: string) => {
    if (!iso) return 'No activity yet';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return 'No activity yet';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'No activity yet';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <DashboardPageHeader
        eyebrow="PROGRAMMING HERO • ADMIN TOOLS INTELLIGENCE"
        title="Tools View & Usage Analytics"
        description="Monitor evaluation engine adoption, tool frequency, and per-user execution breakdown across the placement team."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="h-9 bg-white/10 text-white border-white/20 hover:bg-white/20 font-bold gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Link href="/admin/tools">
              <Button
                size="sm"
                className="h-9 bg-white text-violet-950 hover:bg-violet-50 font-bold gap-1.5 shadow-md"
              >
                <Wrench className="h-3.5 w-3.5" />
                Launch Tools
              </Button>
            </Link>
          </div>
        }
      />

      {/* Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-xs hover:border-violet-300 dark:hover:border-violet-800 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Tool Executions
              </p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {summary?.totalExecutions.toLocaleString() || '0'}
              </h3>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Live Recorded Usage
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 flex items-center justify-center shrink-0">
              <BarChart2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs hover:border-violet-300 dark:hover:border-violet-800 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Candidates Evaluated
              </p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {summary?.totalCandidatesAudited.toLocaleString() || '0'}
              </h3>
              <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium mt-0.5 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Resumes &amp; Portfolios
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Award className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs hover:border-violet-300 dark:hover:border-violet-800 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Most Active Tool
              </p>
              <h3 className="text-xl font-black text-foreground mt-1 truncate max-w-[170px]" title={summary?.topTool.toolName}>
                {(summary?.topTool.count ?? 0) > 0 ? summary?.topTool.toolName : '—'}
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                {(summary?.topTool.count ?? 0) > 0 ? `${summary?.topTool.count} Total Runs` : 'No runs recorded'}
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 flex items-center justify-center shrink-0">
              <FileCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs hover:border-violet-300 dark:hover:border-violet-800 transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Evaluators
              </p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {summary?.uniqueUsersCount || '0'}
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5 flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> Mentors &amp; Managers
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: THE SINGLE CHART (Strictly 1 Chart as Requested) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-violet-600" />
                Tool Usage Frequency Distribution (Total Executions)
              </CardTitle>
              <CardDescription className="text-xs">
                Comparison of single checks vs batch Google Sheet runs across all evaluation engines.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-violet-600 border-violet-200 dark:border-violet-800 text-xs font-semibold self-start sm:self-auto">
              Total: {summary?.totalExecutions || 0} Runs
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[320px] w-full">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-violet-600" />
                Loading real usage data...
              </div>
            ) : mounted && (summary?.totalExecutions ?? 0) > 0 && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: -10, bottom: 25 }}
                  barSize={28}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <p className="font-bold text-foreground text-sm">{d.fullName}</p>
                          <div className="flex items-center justify-between text-violet-600 dark:text-violet-400 font-semibold">
                            <span>• Single Audit:</span>
                            <span>{d['Single Audit']} runs</span>
                          </div>
                          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                            <span>• Batch Sheet Audit:</span>
                            <span>{d['Batch Audit']} runs</span>
                          </div>
                          <div className="pt-1 border-t border-border/80 flex items-center justify-between font-bold text-foreground">
                            <span>Total Runs:</span>
                            <span>{d.Total}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span>Candidates Screened:</span>
                            <span>{d.candidates.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                    iconType="circle"
                  />
                  <Bar
                    dataKey="Single Audit"
                    stackId="a"
                    fill="#8b5cf6"
                    radius={[0, 0, 4, 4]}
                  />
                  <Bar
                    dataKey="Batch Audit"
                    stackId="a"
                    fill="#4f46e5"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 border-2 border-dashed border-border/60 rounded-2xl bg-muted/10">
                <div className="h-12 w-12 rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400 flex items-center justify-center">
                  <BarChart2 className="h-6 w-6" />
                </div>
                <p className="font-bold text-sm text-foreground">No Tool Usage Recorded Yet</p>
                <p className="text-xs text-muted-foreground max-w-md">
                  No evaluations have been run yet. As team members perform audits across ATS, Portfolio, GitHub, and Resume Screening, real usage frequencies will automatically render here.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: TOOL-BY-TOOL USAGE CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-600" />
            Tools Usage Breakdown (Which tool used how many times)
          </h2>
          <span className="text-xs text-muted-foreground">
            {summary?.toolStats.length || 0} active tools
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary?.toolStats.map((tool) => (
            <Card
              key={tool.toolId}
              className="border-border shadow-xs hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800 transition-all flex flex-col justify-between"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 flex items-center justify-center shrink-0 border border-violet-100 dark:border-violet-900">
                      {getToolIcon(tool.toolId)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground leading-tight">
                        {tool.toolName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Last used: {formatDate(tool.lastUsed)}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-violet-600 text-white font-bold text-xs shrink-0 px-2 py-0.5">
                    {tool.totalUsage} Runs
                  </Badge>
                </div>

                {/* Progress bar of total usage */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Share of Total Usage</span>
                    <span className="text-foreground">{tool.percentage}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full"
                      style={{ width: `${tool.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 text-center bg-muted/40 p-2 rounded-lg border border-border/50 text-[11px]">
                  <div>
                    <p className="text-muted-foreground text-[10px]">Single</p>
                    <p className="font-bold text-foreground">{tool.singleCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">Batch Sheet</p>
                    <p className="font-bold text-foreground">{tool.batchCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px]">Candidates</p>
                    <p className="font-bold text-foreground">{tool.candidatesAudited.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end">
                  <Link href={`/admin/tools/${tool.toolId}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-violet-600 dark:text-violet-400 gap-1 hover:bg-violet-50 dark:hover:bg-violet-950/40">
                      Open Tool <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* SECTION 3: PER-USER TOOL USAGE TABLE (Who used which tool how many times) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-600" />
                Team Member Tool Utilization (Who used which tools how many times)
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed user-level audit breakdown, total runs, and tool distribution per evaluator.
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Search evaluator..."
                  className="pl-8 h-8 text-xs focus-visible:ring-violet-500"
                />
              </div>

              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">All Roles</option>
                <option value="mentor">Mentors</option>
                <option value="manager">Managers</option>
                <option value="admin">Admins</option>
              </select>

              <select
                value={selectedToolFilter}
                onChange={(e) => setSelectedToolFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="all">All Tools</option>
                <option value="ATS Resume Check">ATS Resume Check</option>
                <option value="Portfolio Check">Portfolio Check</option>
                <option value="GitHub Profile">GitHub Check</option>
                <option value="Resume Screening">Resume Screening</option>
                <option value="NexView">NexView</option>
                <option value="AI Assignment">AI Assignment</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4 text-left">Team Member</th>
                  <th className="py-3 px-4 text-left">Role</th>
                  <th className="py-3 px-4 text-center">Total Runs</th>
                  <th className="py-3 px-4 text-center">Candidates Screened</th>
                  <th className="py-3 px-4 text-left">Which Tools Used (Breakdown)</th>
                  <th className="py-3 px-4 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.userId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200 font-black text-xs flex items-center justify-center shrink-0 border border-violet-200 dark:border-violet-800">
                            {user.userName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-xs leading-tight">
                              {user.userName}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {user.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`capitalize font-semibold text-[10px] px-2 py-0.5 ${
                            user.userRole === 'admin'
                              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
                              : user.userRole === 'manager'
                              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {user.userRole}
                        </Badge>
                      </td>

                      {/* Total Runs */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-mono font-black text-sm text-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/70">
                          {user.totalUsage}
                        </span>
                      </td>

                      {/* Candidates Screened */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-muted-foreground">
                        {user.candidatesAudited.toLocaleString()}
                      </td>

                      {/* Which Tools Used Breakdown */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                          {Object.entries(user.toolBreakdown).map(([toolName, count]) => (
                            <Badge
                              key={toolName}
                              variant="secondary"
                              className="text-[10px] font-semibold bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900 py-0.5"
                            >
                              {toolName.replace('(60 Marks)', '').replace('Engine', '').replace('Tool', '').trim()}:{' '}
                              <strong className="ml-1 text-violet-900 dark:text-violet-100">{count}</strong>
                            </Badge>
                          ))}
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap text-muted-foreground text-[11px] font-mono">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDate(user.lastActive)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                          <Users className="h-5 w-5" />
                        </div>
                        <p className="font-bold text-foreground">
                          {(summary?.totalExecutions ?? 0) === 0
                            ? 'No Team Member Tool Usage Recorded Yet'
                            : 'No evaluators match the selected filters.'}
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-sm">
                          {(summary?.totalExecutions ?? 0) === 0
                            ? 'When mentors or managers run candidate screening audits, their activity and tool distribution will appear in this table.'
                            : 'Try adjusting your search query or role/tool filter.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
