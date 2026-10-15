// Cloudflare Worker entry point.
//
//   /api/*      -> JSON API (every route except /api/health and /api/config needs a Clerk session)
//   everything  -> the React app built by Vite (served from static assets)

import { can, type Permission } from "../shared/permissions";
import { authenticate } from "./auth";
import { buildSummary, loadSummaryData } from "./dashboard";
import { createSql } from "./db";
import type { Env, WorkerContext } from "./env";
import { HttpError, errorResponse, json, readJson } from "./http";
import { localNow, parsePeriod, resolvePeriod } from "./periods";
import { listTeam, resolveCurrentUser, updateTeamMember } from "./users";

const DEFAULT_TIME_ZONE = "Africa/Tripoli";

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      return await handleApi(request, url, env, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

async function handleApi(
  request: Request,
  url: URL,
  env: Env,
  ctx: WorkerContext,
): Promise<Response> {
  const { pathname } = url;
  const method = request.method.toUpperCase();

  // Public: lets CI and uptime checks confirm the worker and database are up.
  // Public: the browser reads the Clerk publishable key from here at start-up,
  // so the build (and CI) never needs it. A publishable key is meant to be
  // public; the secret key never leaves the worker.
  if (pathname === "/api/config" && method === "GET") {
    if (!env.CLERK_PUBLISHABLE_KEY) {
      throw new HttpError(500, "config_error", "CLERK_PUBLISHABLE_KEY is not configured.");
    }
    return json({ clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY.trim() });
  }

  if (pathname === "/api/health" && method === "GET") {
    const sql = createSql(env.DATABASE_URL);
    await sql("SELECT 1");
    return json({ ok: true, database: "up", time: new Date().toISOString() });
  }

  // Everything below requires a valid Clerk session.
  const claims = await authenticate(request, env);
  const sql = createSql(env.DATABASE_URL);
  const need = (permission: Permission, role: Parameters<typeof can>[0]) =>
    requirePermission(role, permission);

  if (pathname === "/api/dashboard/summary" && method === "GET") {
    // Validate the filter first, then load the user's role and the figures
    // in parallel: one round trip to Neon instead of two in a row. Figures
    // the role may not see are removed before anything is sent.
    const timeZone = env.COMPANY_TIME_ZONE || DEFAULT_TIME_ZONE;
    const resolved = resolvePeriod(parsePeriod(url.searchParams.get("period")), localNow(timeZone), {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    const dataPromise = loadSummaryData(sql, resolved, timeZone);
    dataPromise.catch(() => undefined); // handled below; avoid an unhandled rejection
    const user = await resolveCurrentUser(sql, env, ctx, claims);
    need("dashboard:view", user.role);
    return json(buildSummary(await dataPromise, resolved, user));
  }

  const user = await resolveCurrentUser(sql, env, ctx, claims);

  if (pathname === "/api/me" && method === "GET") {
    return json(user);
  }

  if (pathname === "/api/team" && method === "GET") {
    need("team:manage", user.role);
    return json(await listTeam(sql));
  }

  const teamMatch = /^\/api\/team\/([^/]+)$/.exec(pathname);
  if (teamMatch && method === "PATCH") {
    need("team:manage", user.role);
    return json(
      await updateTeamMember(sql, env, user, decodeURIComponent(teamMatch[1]), await readJson(request)),
    );
  }

  return json({ error: "not_found", message: "No such API route." }, 404);
}

function requirePermission(role: Parameters<typeof can>[0], permission: Permission): void {
  if (!can(role, permission)) {
    throw new HttpError(403, "forbidden", "Your role does not allow this action.");
  }
}
