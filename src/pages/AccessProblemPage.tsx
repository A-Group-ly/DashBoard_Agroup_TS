import { useClerk } from "@clerk/react";
import { LogOut, RefreshCw, ShieldOff, WifiOff } from "lucide-react";

import type { ApiRequestError } from "../lib/api";
import type { Theme } from "../lib/theme";

export function AccessProblemPage({
  theme,
  error,
  onRetry,
}: {
  theme: Theme;
  error: ApiRequestError;
  onRetry: () => void;
}) {
  const { signOut } = useClerk();
  const disabled = error.code === "account_disabled";
  const Icon = disabled ? ShieldOff : WifiOff;

  return (
    <div
      data-theme={theme}
      className="app-shell flex min-h-screen items-center justify-center bg-[#f1f3f5] p-5 text-slate-900"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-slate-100 p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-slate-700">
          <Icon size={22} />
        </div>
        <h1 className="mt-5 font-display text-xl font-bold">
          {disabled ? "Access turned off" : "Could not load the dashboard"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {!disabled && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw size={16} /> Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/sign-in" })}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-300"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
