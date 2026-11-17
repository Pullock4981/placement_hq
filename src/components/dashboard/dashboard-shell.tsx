"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  Kanban,
  LogOut,
  ClipboardCheck,
  BarChart2,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Home,
  FileSpreadsheet,
  Menu,
  UserPlus,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  ListChecks,
  MailCheck,
  Wrench,
  PlayCircle,
  FileCheck,
  Globe,
  Sparkles,
  Tv,
  History,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

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

interface NavSubItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "new" | "live" | "count" | "default";
  isPrimary?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  subItems?: NavSubItem[];
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function roleLabel(role: UserRole): string {
  if (role === "admin") return "Admin";
  return role === "manager" ? "Manager" : "Mentor";
}

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "admin" || role === "manager") return "default";
  return "outline";
}

function RoleBasedSidebar({
  role,
  collapsed = false,
}: {
  role: UserRole;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    Tools: true,
  });

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => {
      const current = prev[label] ?? true;
      return {
        ...prev,
        [label]: !current,
      };
    });
  };

  const toolsBase = `/${role}/tools`;
  const toolsNavItem: NavItem = {
    href: toolsBase,
    label: "Tools",
    icon: Wrench,
    subItems: [
      {
        href: `${toolsBase}/resume-screening`,
        label: "Resume Screening",
        icon: PlayCircle,
      },
      {
        href: `${toolsBase}/ats-resume-check`,
        label: "ATS Resume Check",
        icon: FileCheck,
      },
      {
        href: `${toolsBase}/github-profile-check`,
        label: "GitHub Profile Check",
        icon: GithubIcon,
      },
      // Note: "LinkedIn Profile Check" is explicitly excluded per user request
      {
        href: `${toolsBase}/portfolio-check`,
        label: "Portfolio Check (60 Marks)",
        icon: Globe,
        badge: "New",
        badgeVariant: "new",
      },
      {
        href: `${toolsBase}/ai-assignment-check`,
        label: "AI Assignment Check",
        icon: Sparkles,
        badge: "Live",
        badgeVariant: "live",
      },
      {
        href: `${toolsBase}/nexview-tool`,
        label: "NexView Tool",
        icon: Tv,
        badge: "Live",
        badgeVariant: "live",
      },
      {
        href: `${toolsBase}/screening-history`,
        label: "Screening History",
        icon: History,
      },
    ],
  };

  const managerNav: NavSection[] = [
    {
      label: "Overview",
      items: [{ href: `/${role}`, label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Placement Operations",
      items: [
        {
          href: `/${role}/placement`,
          label: "Placement Workspace",
          icon: Kanban,
        },
        {
          href: `/${role}/scrum`,
          label: "Scrum Updates",
          icon: ClipboardCheck,
        },
      ],
    },
    {
      label: "Performance",
      items: [
        {
          href: `/${role}/performance/monthly-goals`,
          label: "Monthly Goals",
          icon: Target,
        },
      ],
    },
    {
      label: "Tools & Screening",
      items: [toolsNavItem],
    },
    {
      label: "Administration",
      items: [
        { href: "/manager/users", label: "User Management", icon: Users },
        {
          href: "/admin/tools-view",
          label: "Tools View",
          icon: BarChart2,
          badge: "Analytics",
        },
      ],
    },
  ];

  const mentorNav: NavSection[] = [
    {
      label: "Overview",
      items: [
        { href: `/${role}`, label: "My Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "My Performance",
      items: [
        {
          href: `/${role}/performance/weekly-goals`,
          label: "Weekly Goals",
          icon: ListChecks,
        },
        {
          href: `/${role}/performance/monthly-goals`,
          label: "Monthly Goals",
          icon: Target,
        },
        {
          href: `/${role}/placement-followups`,
          label: "Placement Follow-ups",
          icon: MailCheck,
        },
      ],
    },
    {
      label: "Tools & Screening",
      items: [toolsNavItem],
    },
  ];

  const adminNav: NavSection[] = [
    {
      label: "Administration",
      items: [
        { href: "/admin/users", label: "User Management", icon: Users },
        {
          href: "/admin/sheets",
          label: "Sheet Management",
          icon: FileSpreadsheet,
        },
        {
          href: "/admin/tools-view",
          label: "Tools View",
          icon: BarChart2,
          badge: "Analytics",
        },
      ],
    },
    {
      label: "Tools & Screening",
      items: [toolsNavItem],
    },
  ];

  const navSections =
    role === "admin" ? adminNav : role === "manager" ? managerNav : mentorNav;

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === `/${role}`;
    if (href === `/${role}/students`) return pathname === `/${role}/students`;
    if (href === `/${role}/analytics`) return pathname === `/${role}/analytics`;
    if (href === `/${role}/placement`) return pathname === `/${role}/placement`;
    return pathname.startsWith(href);
  };

  return (
    <>
      {navSections.map((section, si) => (
        <div
          key={si}
          className={cn("space-y-1.5 pt-1", collapsed && "space-y-2")}
        >
          {section.label && !collapsed && (
            <p className="px-3 mb-2 text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const isDropdown = !!item.subItems && item.subItems.length > 0;
            const isExpanded = openDropdowns[item.label] ?? true;
            const active = isActive(item.href);

            if (isDropdown) {
              return (
                <div key={item.label} className="space-y-1">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const currentExpanded = openDropdowns[item.label] ?? true;
                      if (currentExpanded) {
                        // When open, clicking closes it
                        toggleDropdown(item.label);
                      } else {
                        // When closed, clicking opens it and navigates to default tools page if not already there
                        toggleDropdown(item.label);
                        if (!pathname.startsWith(item.href)) {
                          router.push(item.href);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleDropdown(item.label);
                      }
                    }}
                    className={cn(
                      "group relative flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer select-none",
                      collapsed && "h-11 justify-center px-0 py-0",
                      active
                        ? "border-violet-200 bg-gradient-to-r from-violet-100 to-indigo-50 text-violet-700 shadow-sm dark:border-violet-900 dark:from-violet-950/60 dark:to-indigo-950/30 dark:text-violet-300"
                        : "border-transparent text-muted-foreground hover:border-violet-100 hover:bg-violet-50/70 hover:text-violet-700 dark:hover:border-violet-950 dark:hover:bg-violet-950/30 dark:hover:text-violet-300",
                    )}
                    aria-expanded={isExpanded}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
                    )}
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon
                        className={cn(
                          "w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105",
                          active ? "text-primary" : "text-muted-foreground/80",
                        )}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>

                    {!collapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleDropdown(item.label);
                        }}
                        className="p-1 -mr-1 rounded-md text-muted-foreground/80 hover:bg-violet-200/50 hover:text-violet-700 dark:hover:bg-violet-900/50 dark:hover:text-violet-200 transition-colors"
                        aria-label={`Toggle ${item.label} menu`}
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </button>
                    )}
                  </div>

                  {/* Submenu Dropdown Items */}
                  {isExpanded && !collapsed && (
                    <div className="ml-3.5 space-y-1 border-l-2 border-violet-200/70 pl-2.5 dark:border-violet-900/60 pt-0.5">
                      {item.subItems?.map((sub) => {
                        const subActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={cn(
                              "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors",
                              subActive
                                ? "bg-violet-100 font-bold text-violet-800 dark:bg-violet-950/70 dark:text-violet-200 shadow-xs"
                                : "text-muted-foreground hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-300",
                            )}
                          >
                            <sub.icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                                subActive
                                  ? "text-violet-600 dark:text-violet-400"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span className="flex-1 truncate">{sub.label}</span>
                            {sub.badge && (
                              <span
                                className={cn(
                                  "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold leading-none",
                                  sub.badgeVariant === "new"
                                    ? "border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                                    : sub.badgeVariant === "live"
                                      ? "border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
                                )}
                              >
                                {sub.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                  collapsed && "h-11 justify-center px-0 py-0",
                  active
                    ? "border-violet-200 bg-gradient-to-r from-violet-100 to-indigo-50 text-violet-700 shadow-sm dark:border-violet-900 dark:from-violet-950/60 dark:to-indigo-950/30 dark:text-violet-300"
                    : "border-transparent text-muted-foreground hover:border-violet-100 hover:bg-violet-50/70 hover:text-violet-700 dark:hover:border-violet-950 dark:hover:bg-violet-950/30 dark:hover:text-violet-300",
                )}
              >
                {/* Active link left accent bar */}
                {active && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
                )}

                <item.icon
                  className={cn(
                    "w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105",
                    active ? "text-primary" : "text-muted-foreground/80",
                  )}
                />
                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}

                {item.badge && !collapsed && (
                  <span className="ml-auto text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
}

export function DashboardShell({ children, title }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, isLoading, isDemoMode } = useAuth();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-semibold text-sm">
            Loading session…
          </p>
        </div>
      </div>
    );
  }

  // Segment breadcrumbs based on route
  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: Array<{
      label: string;
      icon: React.ComponentType<{ className?: string }> | null;
      href: string;
    }> = [{ label: "Home", icon: Home, href: `/${user?.role ?? "mentor"}` }];

    let pathAcc = "";
    segments.forEach((seg, idx) => {
      pathAcc += `/${seg}`;
      if (idx === 0) return; // skip the base role route

      const label = seg
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      crumbs.push({
        label,
        icon: null,
        href: pathAcc,
      });
    });

    return crumbs;
  };

  const crumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen flex bg-background" data-title={title}>
      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-violet-200/60 bg-gradient-to-b from-card via-card to-violet-50/45 shadow-[4px_0_24px_rgba(76,29,149,0.05)] transition-[width] duration-300 lg:flex dark:border-violet-950 dark:to-violet-950/15",
          sidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        {/* Brand details */}
        <div
          className={cn(
            "sticky top-0 z-10 flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-violet-200/60 bg-card/95 px-5 backdrop-blur-xl dark:border-violet-950",
            sidebarCollapsed && "justify-center px-2",
          )}
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
            <Image
              src="/assets/placementhq-logo.png"
              alt="PlacementHQ"
              width={40}
              height={40}
              className="block h-full w-full object-cover"
              priority
            />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-foreground">
                  PlacementHQ
                </span>
                <Badge
                  variant={roleBadgeVariant(user?.role ?? "mentor")}
                  className="text-[9px] uppercase tracking-widest px-1.5 h-4.5 font-bold shadow-none leading-none scale-90 origin-left shrink-0"
                >
                  {roleLabel(user?.role ?? "mentor")}
                </Badge>
              </div>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-violet-500">
                Programming Hero
              </p>
            </div>
          )}
          <button
            type="button"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-violet-200 bg-card text-violet-600 shadow-md transition hover:scale-105 hover:bg-violet-50 dark:border-violet-900 dark:hover:bg-violet-950"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Nav lists */}
        <nav
          className={cn(
            "flex-1 space-y-5 overflow-y-auto py-4 scrollbar-thin",
            sidebarCollapsed ? "px-2" : "px-3",
          )}
        >
          <RoleBasedSidebar
            role={user?.role ?? "mentor"}
            collapsed={sidebarCollapsed}
          />
        </nav>

        {/* User profile footer */}
        {user && (
          <div
            className={cn(
              "shrink-0 space-y-3 border-t border-violet-200/60 bg-card/70 p-4 dark:border-violet-950",
              sidebarCollapsed && "flex flex-col items-center p-2.5",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3 px-1",
                sidebarCollapsed && "justify-center px-0",
              )}
            >
              <Avatar className="relative h-9 w-9 shrink-0 border border-violet-200 shadow-sm transition-transform duration-200 dark:border-violet-900">
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-xs font-extrabold text-white">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate leading-tight">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                    {user.email}
                  </p>
                </div>
              )}
            </div>
            {isDemoMode ? (
              <div
                title="Hosted demo mode"
                className={cn(
                  "flex items-center gap-2 rounded-xl bg-violet-100 px-3 py-2 text-[10px] font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
                  sidebarCollapsed && "h-9 w-9 justify-center p-0",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />{" "}
                {!sidebarCollapsed && "Hosted demo mode"}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sign out"
                title="Sign out"
                className={cn(
                  "h-9 w-full justify-start rounded-xl px-2 text-xs font-bold text-muted-foreground transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30",
                  sidebarCollapsed && "w-9 justify-center p-0",
                )}
                onClick={handleLogout}
              >
                <LogOut
                  className={cn("h-3.5 w-3.5", !sidebarCollapsed && "mr-2")}
                />
                {!sidebarCollapsed && "Sign Out"}
              </Button>
            )}
          </div>
        )}
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Persistent dashboard header */}
        <header
          className={cn(
            "fixed inset-x-0 top-0 z-30 flex h-[4.5rem] items-center justify-between border-b border-violet-200/70 bg-card/90 px-4 shadow-[0_8px_24px_rgba(76,29,149,0.07)] backdrop-blur-xl transition-[left] duration-300 sm:px-6 dark:border-violet-900/70",
            sidebarCollapsed ? "lg:left-20" : "lg:left-64",
          )}
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" />
          {/* Left section: Breadcrumbs navigation */}
          <div className="flex min-w-0 items-center gap-3">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-xl border border-violet-200/70 bg-violet-50 text-violet-700 lg:hidden dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
                  />
                }
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[18rem] gap-0 border-violet-200/70 bg-gradient-to-b from-card to-violet-50/50 p-0 dark:border-violet-900 dark:to-violet-950/20"
                showCloseButton
              >
                <SheetHeader className="border-b border-violet-200/60 px-5 py-4 text-left dark:border-violet-900">
                  <SheetTitle className="flex items-center gap-2.5 font-black">
                    <span className="h-8 w-8 overflow-hidden rounded-lg">
                      <Image
                        src="/assets/placementhq-logo.png"
                        alt="PlacementHQ"
                        width={32}
                        height={32}
                        className="block h-full w-full object-cover"
                      />
                    </span>{" "}
                    PlacementHQ
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    Programming Hero operations
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                  <RoleBasedSidebar role={user?.role ?? "mentor"} />
                </nav>
                {user && (
                  <div className="border-t bg-muted/20 p-4">
                    <p className="truncate text-xs font-bold">{user.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-foreground sm:text-base">
                {title}
              </p>
              <div className="mt-0.5 hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
                {crumbs.map((crumb, idx) => (
                  <div key={crumb.href} className="flex items-center gap-1">
                    {idx > 0 && (
                      <ChevronRight className="h-2.5 w-2.5 text-violet-400" />
                    )}
                    {idx === crumbs.length - 1 ? (
                      <span className="font-bold text-violet-600 dark:text-violet-300">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="font-semibold transition-colors hover:text-violet-600"
                      >
                        {crumb.icon ? (
                          <crumb.icon className="h-3 w-3" />
                        ) : (
                          crumb.label
                        )}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right section: user, notifications & date */}
          <div className="flex items-center gap-2 sm:gap-3">
            <p className="hidden rounded-full border border-violet-200/70 bg-violet-50/80 px-3 py-1.5 text-[10px] font-bold text-violet-700 xl:block dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-300">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
            <ThemeToggle />
            <NotificationBell />
            {user && (
              <div className="ml-1 hidden items-center gap-2.5 border-l border-border/70 pl-3 md:flex">
                <Avatar className="h-9 w-9 border-2 border-violet-200 shadow-sm dark:border-violet-800">
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-[10px] font-black text-white">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-32 leading-tight">
                  <p className="truncate text-xs font-black">{user.name}</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                    {roleLabel(user.role)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>
        <div aria-hidden="true" className="h-[4.5rem] shrink-0" />

        {/* Content viewport */}
        <main className="flex-1 overflow-y-auto bg-background p-4 scrollbar-thin sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
