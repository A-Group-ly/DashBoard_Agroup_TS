import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";

import "./index.css";
import "./theme.css";
import App from "./App.tsx";
import { navigate } from "./lib/router";

const root = createRoot(document.getElementById("root")!);

/**
 * The Clerk publishable key comes from the build (VITE_CLERK_PUBLISHABLE_KEY,
 * handy for local development) or, if it was not set at build time, from the
 * worker at /api/config. That way CI can build the site without any Clerk
 * secret, and the key lives in one place: the worker's settings.
 */
async function loadPublishableKey(): Promise<string | null> {
  const fromBuild = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim();
  if (fromBuild) return fromBuild;
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { clerkPublishableKey?: string };
    return body.clerkPublishableKey?.trim() || null;
  } catch {
    return null;
  }
}

function renderConfigError() {
  root.render(
    <StrictMode>
      <main className="flex min-h-screen items-center justify-center bg-[#f1f3f5] p-6 text-slate-900">
        <div className="max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <h1 className="font-display text-xl font-bold">Configuration needed</h1>
          <p className="mt-2 text-sm text-slate-600">
            The Clerk publishable key is missing. Set <code>CLERK_PUBLISHABLE_KEY</code> in the
            Cloudflare worker settings (or <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>.env</code> for
            local development) and reload.
          </p>
        </div>
      </main>
    </StrictMode>,
  );
}

function renderApp(publishableKey: string) {
  root.render(
    <StrictMode>
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl="/sign-in"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
        routerPush={(to: string) => navigate(to)}
        routerReplace={(to: string) => navigate(to, { replace: true })}
        appearance={{
          variables: {
            colorPrimary: "#262626",
            fontFamily: '"Hanken Grotesk", "Segoe UI", Arial, sans-serif',
            borderRadius: "0.75rem",
          },
        }}
      >
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}

void loadPublishableKey().then((key) => (key ? renderApp(key) : renderConfigError()));
