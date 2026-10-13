import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";

import "./index.css";
import "./theme.css";
import App from "./App.tsx";
import { navigate } from "./lib/router";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const root = createRoot(document.getElementById("root")!);

if (!publishableKey) {
  root.render(
    <StrictMode>
      <main className="flex min-h-screen items-center justify-center bg-[#f1f3f5] p-6 text-slate-900">
        <div className="max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
          <h1 className="font-display text-xl font-bold">Configuration needed</h1>
          <p className="mt-2 text-sm text-slate-600">
            <code>VITE_CLERK_PUBLISHABLE_KEY</code> is not set. Copy <code>.env.example</code> to{" "}
            <code>.env</code>, add your Clerk publishable key and rebuild.
          </p>
        </div>
      </main>
    </StrictMode>,
  );
} else {
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
