import type { ReactNode } from "react";
import { UserButton } from "@clerk/react";
import { LayoutDashboard, Moon, Sun, Users } from "lucide-react";

import { ROLE_LABELS, can } from "../../shared/permissions";
import type { CurrentUser } from "../../shared/types";
import { navigate } from "../lib/router";
import type { Theme } from "../lib/theme";

type Page = "overview" | "team";

export function AppShell({
  user,
  page,
  theme,
  toggleTheme,
  children,
}: {
  user: CurrentUser;
  page: Page;
  theme: Theme;
  toggleTheme: () => void;
  children: ReactNode;
}) {
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const tabs: { id: Page; label: string; href: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", href: "/", icon: LayoutDashboard },
  ];
  if (can(user.role, "team:manage")) {
    tabs.push({ id: "team", label: "Team & roles", href: "/team", icon: Users });
  }

  return (
    <div
      data-theme={theme}
      className="app-shell min-h-screen bg-[#f1f3f5] text-slate-900 transition-colors duration-300"
    >
      <header className="sticky top-0 z-20 border-b border-slate-300 bg-slate-100">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="brand-logo-frame !h-11 !w-11 sm:!h-[52px] sm:!w-[52px]">
              <img src="/a-group-logo.png" alt="A-Group" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[11px] font-bold tracking-[0.18em] text-slate-600 sm:text-xs">
                A-GROUP
              </p>
              <p className="truncate font-display text-lg font-bold tracking-tight sm:text-2xl">
                Financial Overview
              </p>
            </div>
          </a>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {tabs.length > 1 && (
              <nav className="hidden rounded-xl border border-slate-300 bg-slate-200 p-1 md:flex">
                {tabs.map((tab) => (
                  <TabLink key={tab.id} tab={tab} active={page === tab.id} />
                ))}
              </nav>
            )}

            <span
              className="hidden rounded-full border border-slate-300 bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:inline-block"
              title={`Signed in as ${user.email}`}
            >
              {ROLE_LABELS[user.role]}
            </span>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-slate-800 transition hover:bg-slate-300"
            >
              <ThemeIcon size={18} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center">
              <UserButton />
            </div>
          </div>
        </div>

        {tabs.length > 1 && (
          <nav className="flex gap-1 border-t border-slate-300 px-4 py-2 md:hidden">
            {tabs.map((tab) => (
              <TabLink key={tab.id} tab={tab} active={page === tab.id} grow />
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-8 sm:py-8">
        {children}

        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-300 py-5 text-xs text-slate-600 sm:flex-row">
          <span>A-Group · Financial Dashboard</span>
          <span>
            Signed in as {user.email} · {ROLE_LABELS[user.role]}
          </span>
        </footer>
      </main>
    </div>
  );
}

function TabLink({
  tab,
  active,
  grow = false,
}: {
  tab: { label: string; href: string; icon: typeof Users };
  active: boolean;
  grow?: boolean;
}) {
  const Icon = tab.icon;
  return (
    <a
      href={tab.href}
      onClick={(event) => {
        event.preventDefault();
        navigate(tab.href);
      }}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
        grow ? "flex-1" : ""
      } ${active ? "bg-slate-700 text-white" : "text-slate-700 hover:bg-slate-300"}`}
    >
      <Icon size={16} />
      {tab.label}
    </a>
  );
}
