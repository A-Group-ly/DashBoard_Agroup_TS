import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/react";
import { ChevronDown, Info, LogOut, Moon, ShieldCheck, Sun, UserCog } from "lucide-react";

import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../../shared/permissions";
import type { CurrentUser } from "../../shared/types";
import type { Theme } from "../lib/theme";

/**
 * Avatar button with the account menu. The role is shown inside the menu as
 * plain information (not a button), next to the person's name and email.
 */
export function AccountMenu({
  user,
  theme,
  toggleTheme,
}: {
  user: CurrentUser;
  theme: Theme;
  toggleTheme: () => void;
}) {
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const name = user.fullName ?? clerkUser?.fullName ?? user.email;
  const initial = name.trim().slice(0, 1).toUpperCase();
  const imageUrl = clerkUser?.hasImage ? clerkUser.imageUrl : null;

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-200 py-1 pl-1 pr-2 text-slate-800 hover:border-slate-400 hover:bg-slate-300 sm:pr-3"
      >
        <Avatar imageUrl={imageUrl} initial={initial} size={32} />
        <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">{name}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="pop-in absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-xl"
        >
          <div className="flex items-center gap-3 p-4">
            <Avatar imageUrl={imageUrl} initial={initial} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{name}</p>
              <p className="truncate text-xs text-slate-600">{user.email}</p>
            </div>
          </div>

          {/* Informational only: roles are changed by a Super admin on Team & roles. */}
          <div className="mx-4 mb-3 rounded-xl border border-slate-300 bg-slate-200 p-3" aria-label="Your role">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ShieldCheck size={14} /> Your role
              </span>
              <span className="text-sm font-bold text-slate-900">{ROLE_LABELS[user.role]}</span>
            </div>
            <p className="mt-1.5 flex gap-1.5 text-xs text-slate-600">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                {ROLE_DESCRIPTIONS[user.role]}
                {user.role !== "SUPER_ADMIN" && " Only a Super admin can change roles."}
              </span>
            </p>
          </div>

          <div className="border-t border-slate-300 p-2">
            <MenuItem
              icon={UserCog}
              label="Manage account"
              onClick={() => {
                setOpen(false);
                clerk.openUserProfile();
              }}
            />
            <MenuItem
              icon={ThemeIcon}
              label={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={toggleTheme}
            />
            <MenuItem
              icon={LogOut}
              label="Sign out"
              onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof LogOut;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-300"
    >
      <Icon size={17} className="text-slate-600" />
      {label}
    </button>
  );
}

function Avatar({ imageUrl, initial, size }: { imageUrl: string | null; initial: string; size: number }) {
  return imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-700 font-display text-sm font-bold text-white"
      style={{ width: size, height: size }}
    >
      {initial}
    </span>
  );
}
