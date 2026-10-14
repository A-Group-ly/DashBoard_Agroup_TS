import { useAuth } from "@clerk/react";
import { Suspense, lazy, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import type { CurrentUser } from "../shared/types";
import { can } from "../shared/permissions";
import { AppShell } from "./components/AppShell";
import { ApiRequestError, useApi } from "./lib/api";
import { navigate, usePathname } from "./lib/router";
import { useTheme, type Theme } from "./lib/theme";
import { AccessProblemPage } from "./pages/AccessProblemPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

const AUTH_ROUTES = ["/sign-in", "/sign-up"];

// Only Super admins open this page, so it is downloaded on demand.
const TeamPage = lazy(() => import("./pages/TeamPage").then((module) => ({ default: module.TeamPage })));

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Route guard: signed-out visitors always land on the sign-in page,
  // signed-in users never see it.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn && !isAuthRoute) navigate("/sign-in", { replace: true });
    if (isSignedIn && isAuthRoute) navigate("/", { replace: true });
  }, [isLoaded, isSignedIn, isAuthRoute]);

  if (!isLoaded) return <FullPageLoader theme={theme} label="Checking your session..." />;

  if (!isSignedIn) {
    return <AuthPage mode={pathname.startsWith("/sign-up") ? "sign-up" : "sign-in"} />;
  }

  if (isAuthRoute) return <FullPageLoader theme={theme} label="Signing you in..." />;

  return <SignedInApp pathname={pathname} theme={theme} toggleTheme={toggleTheme} />;
}

function SignedInApp({
  pathname,
  theme,
  toggleTheme,
}: {
  pathname: string;
  theme: Theme;
  toggleTheme: () => void;
}) {
  const api = useApi();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<CurrentUser>("/api/me")
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiRequestError
            ? err
            : new ApiRequestError(0, "network_error", "Could not reach the server."),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const canManageTeam = user ? can(user.role, "team:manage") : false;
  const page = pathname === "/team" && canManageTeam ? "team" : "overview";

  // Unknown paths (or /team without permission) fall back to the overview.
  useEffect(() => {
    if (!user) return;
    if (page === "overview" && pathname !== "/") navigate("/", { replace: true });
  }, [user, page, pathname]);

  if (error) {
    return (
      <AccessProblemPage theme={theme} error={error} onRetry={() => setAttempt((n) => n + 1)} />
    );
  }

  if (!user) return <FullPageLoader theme={theme} label="Loading your workspace..." />;

  return (
    <AppShell user={user} page={page} theme={theme} toggleTheme={toggleTheme}>
      {page === "team" ? (
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <LoaderCircle size={16} className="animate-spin" /> Loading team...
            </div>
          }
        >
          <TeamPage currentUser={user} />
        </Suspense>
      ) : (
        <DashboardPage user={user} />
      )}
    </AppShell>
  );
}

function FullPageLoader({ theme, label }: { theme: Theme; label: string }) {
  return (
    <div
      data-theme={theme}
      className="app-shell flex min-h-screen items-center justify-center bg-[#f1f3f5] text-slate-600"
    >
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle className="animate-spin" size={20} />
        {label}
      </div>
    </div>
  );
}
