'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Search, Download, Eye, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SCREENING_HISTORY } from '../constants';

export function ScreeningHistoryView() {
  const [search, setSearch] = useState('');
  const [toolFilter, setToolFilter] = useState('All');

  const filtered = MOCK_SCREENING_HISTORY.filter((rec) => {
    const matchSearch = rec.studentName.toLowerCase().includes(search.toLowerCase()) || rec.batch.toLowerCase().includes(search.toLowerCase());
    const matchTool = toolFilter === 'All' || rec.toolUsed === toolFilter;
    return matchSearch && matchTool;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <History className="h-4 w-4" /> Comprehensive Audit Log
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Screening History</h1>
          <p className="text-sm text-muted-foreground">Historical records of candidate audits across ATS, GitHub, Portfolio, AI Assignment, and NexView.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="px-3 py-1 font-bold text-xs bg-slate-100 dark:bg-slate-800">
            {filtered.length} Total Screenings
          </Badge>
          <Button variant="outline" size="sm" onClick={() => toast.success('Exporting CSV report...')}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export Data
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search candidate or batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter:
              </span>
              {['All', 'Resume Screening', 'ATS Resume Check', 'Portfolio (60M)', 'NexView Tool'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setToolFilter(t)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    toolFilter === t
                      ? 'bg-violet-600 text-white font-bold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-bold text-xs">Record ID</TableHead>
                <TableHead className="font-bold text-xs">Candidate Name</TableHead>
                <TableHead className="font-bold text-xs">Batch</TableHead>
                <TableHead className="font-bold text-xs">Tool Evaluated</TableHead>
                <TableHead className="font-bold text-xs">Score / Grade</TableHead>
                <TableHead className="font-bold text-xs">Status</TableHead>
                <TableHead className="font-bold text-xs">Date</TableHead>
                <TableHead className="text-right font-bold text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                    No screening records found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">{item.id}</TableCell>
                    <TableCell className="font-bold text-xs">{item.studentName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.batch}</TableCell>
                    <TableCell className="text-xs font-medium">{item.toolUsed}</TableCell>
                    <TableCell className="text-xs font-bold text-foreground">{item.score}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : item.status === 'Passed'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.date}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info(`Viewing details for ${item.studentName}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

