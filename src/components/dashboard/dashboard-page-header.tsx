"use client";

import type { ReactNode } from "react";
import { Quote } from "lucide-react";
import { usePathname } from "next/navigation";
import { DASHBOARD_REFLECTIONS } from "@/components/dashboard/dashboard-reflections";

function quoteIndex(pathname: string) {
  return (
    Array.from(pathname).reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    ) % DASHBOARD_REFLECTIONS.length
  );
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  context,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  context?: ReactNode;
}) {
  const pathname = usePathname();
  const reflection = DASHBOARD_REFLECTIONS[quoteIndex(pathname)];

  return (
    <header className="relative overflow-hidden rounded-3xl border border-violet-300/30 bg-gradient-to-br from-[#4c1d95] via-[#5b21b6] to-[#312e81] px-6 py-6 text-white shadow-xl shadow-violet-950/10 sm:px-8">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)] lg:items-center">
        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-violet-100">
            {description}
          </p>
          {context ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {context}
            </div>
          ) : null}
        </div>
        <aside className="min-w-0 border-t border-white/15 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
            <Quote className="h-4 w-4" />
            Daily reflection
          </div>
          <blockquote className="mt-2 font-serif text-base font-semibold italic leading-7 tracking-wide text-white sm:text-lg">
            “{reflection.text}”
          </blockquote>
          <p className="mt-1.5 text-xs font-bold text-violet-200">
            — {reflection.source}
          </p>
        </aside>
      </div>
    </header>
  );
}
