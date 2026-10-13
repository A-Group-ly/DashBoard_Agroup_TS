// Cloudflare Worker entry point.
//
//   /api/*      -> JSON API (every route except /api/health needs a Clerk session)
//   everything  -> the React app built by Vite (served from static assets)

import { can, type Permission } from "../shared/permissions";
import type { Period } from "../shared/types";
import { authenticate } from "./auth";
import { getDashboardSummary } from "./dashboard";
import { createSql } from "./db";
import type { Env, WorkerContext } from "./env";
import { HttpError, errorResponse, json, readJson } from "./http";
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
  if (pathname === "/api/health" && method === "GET") {
    const sql = createSql(env.DATABASE_URL);
    await sql("SELECT 1");
    return json({ ok: true, database: "up", time: new Date().toISOString() });
  }

  // Everything below requires a valid Clerk session.
  const claims = await authenticate(request, env);
  const sql = createSql(env.DATABASE_URL);
  const user = await resolveCurrentUser(sql, env, ctx, claims);
  const need = (permission: Permission) => requirePermission(user.role, permission);

  if (pathname === "/api/me" && method === "GET") {
    return json(user);
  }

  if (pathname === "/api/dashboard/summary" && method === "GET") {
    need("dashboard:view");
    const period = parsePeriod(url.searchParams.get("period"));
    const timeZone = env.COMPANY_TIME_ZONE || DEFAULT_TIME_ZONE;
    return json(await getDashboardSummary(sql, user, period, timeZone));
  }

  if (pathname === "/api/team" && method === "GET") {
    need("team:manage");
    return json(await listTeam(sql));
  }

  const teamMatch = /^\/api\/team\/([^/]+)$/.exec(pathname);
  if (teamMatch && method === "PATCH") {
    need("team:manage");
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

function parsePeriod(value: string | null): Period {
  if (value === null || value === "monthly") return "monthly";
  if (value === "weekly") return "weekly";
  throw new HttpError(400, "bad_request", "period must be monthly or weekly");
}
