'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, FileCheck, Globe, Sparkles, Tv, History, ArrowRight, BarChart2 } from 'lucide-react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}

interface ToolsOverviewProps {
  basePath?: string;
}

export function ToolsOverview({ basePath = '/tools' }: ToolsOverviewProps) {
  const tools = [
    {
      title: 'Resume Screening',
      description: 'Automated AI-assisted screening for candidate resumes and experience matching.',
      icon: PlayCircle,
      href: `${basePath}/resume-screening`,
      badge: 'Primary',
      badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
    },
    {
      title: 'ATS Resume Check',
      description: 'Audit resume formatting, key section detection, and ATS keyword relevance score.',
      icon: FileCheck,
      href: `${basePath}/ats-resume-check`,
    },
    {
      title: 'GitHub Profile Check',
      description: 'Analyze student GitHub profile health, pinned repos, commit streak, and repo quality.',
      icon: GithubIcon,
      href: `${basePath}/github-profile-check`,
    },
    {
      title: 'Portfolio Check (60 Marks)',
      description: 'Standard 60-marks rubric evaluation covering responsiveness, live demos, and code quality.',
      icon: Globe,
      href: `${basePath}/portfolio-check`,
      badge: 'New',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    },
    {
      title: 'AI Assignment Check',
      description: 'Intelligent code review, plagiarism detection, and requirement verification on submissions.',
      icon: Sparkles,
      href: `${basePath}/ai-assignment-check`,
      badge: 'Live',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    },
    {
      title: 'NexView Tool',
      description: 'Video and interview readiness assessment dashboard for candidate placement pipeline.',
      icon: Tv,
      href: `${basePath}/nexview-tool`,
      badge: 'Live',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    },
    {
      title: 'Screening History',
      description: 'Comprehensive historical log of past screenings, rubric evaluations, and exportable data.',
      icon: History,
      href: `${basePath}/screening-history`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Placement Operations Tools</h1>
          <p className="text-sm text-muted-foreground">Comprehensive student evaluation, ATS audit, and profile screening suite.</p>
        </div>
        <Link href="/admin/tools-view">
          <Button variant="outline" size="sm" className="h-10 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 font-bold gap-2">
            <BarChart2 className="h-4 w-4 text-violet-600" />
            Tools View Analytics
          </Button>
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.title} className="group relative overflow-hidden transition-all duration-200 hover:border-violet-300 hover:shadow-lg dark:hover:border-violet-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  <tool.icon className="h-6 w-6" />
                </div>
                {tool.badge && (
                  <Badge variant="outline" className={tool.badgeColor}>
                    {tool.badge}
                  </Badge>
                )}
              </div>
              <CardTitle className="mt-3 text-lg font-bold">{tool.title}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={tool.href} className="w-full block">
                <Button variant="outline" size="sm" type="button" className="w-full justify-between font-semibold group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600 transition-colors">
                  Launch Tool <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

