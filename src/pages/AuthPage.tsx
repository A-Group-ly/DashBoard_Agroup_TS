import { SignIn, SignUp } from "@clerk/react";
import { ChartColumn, LockKeyhole, ShieldCheck } from "lucide-react";

const YEAR = new Date().getFullYear();

const FEATURES = [
  { icon: ChartColumn, text: "Live subscription, revenue and profit figures" },
  { icon: ShieldCheck, text: "Role-based access for finance and support teams" },
  { icon: LockKeyhole, text: "Secure sign-in, every page protected" },
];

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f1f3f5] lg:flex-row">
      <aside className="relative overflow-hidden bg-[#171717] px-6 py-8 text-white sm:px-10 lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="auth-glow" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <div className="brand-logo-frame !border-white/15 !bg-[#232323] !p-0">
            <img src="/a-group-logo.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-display text-sm font-bold tracking-[0.2em] text-white/70">A-GROUP</p>
            <p className="font-display text-lg font-bold">Financial Overview</p>
          </div>
        </div>

        <div className="relative mt-8 lg:mt-0">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {mode === "sign-in" ? "Welcome back." : "Create your account."}
          </h1>
          <p className="mt-3 max-w-md text-base text-white/70">
            Empowering Libya through innovative digital solutions. Sign in to see how A-Group is
            performing today.
          </p>

          <ul className="mt-8 hidden space-y-4 sm:block">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                  <Icon size={17} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-8 hidden text-xs text-white/40 lg:block">
          © {YEAR} A-Group · Tripoli, Libya
        </p>
      </aside>

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-8 sm:py-12">
        <div className="w-full max-w-[400px]">
          {mode === "sign-in" ? (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
          ) : (
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
          )}
        </div>
      </main>
    </div>
  );
}
