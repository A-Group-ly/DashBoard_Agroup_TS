/** Bindings and environment variables available to the worker. */
export interface Env {
  /** Static files built by Vite (configured in wrangler.jsonc). */
  ASSETS: { fetch(request: Request): Promise<Response> };

  /** Neon connection string (secret). */
  DATABASE_URL: string;

  /** Clerk secret key, used to look up a new user's email (secret). */
  CLERK_SECRET_KEY: string;

  /** Clerk publishable key; the JWKS URL is derived from it. */
  CLERK_PUBLISHABLE_KEY: string;

  /** Optional PEM public key from Clerk, verifies tokens without a network call. */
  CLERK_JWT_KEY?: string;

  /** Optional extra origins allowed in the token's `azp` claim, comma separated. */
  CLERK_AUTHORIZED_PARTIES?: string;

  /** Optional comma-separated emails that are always Super admins. */
  ADMIN_EMAILS?: string;

  /** Optional IANA time zone for reporting periods (default Africa/Tripoli). */
  COMPANY_TIME_ZONE?: string;
}

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}
