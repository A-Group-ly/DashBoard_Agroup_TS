// Links Clerk accounts to dashboard roles stored in Neon.

import { ROLE_PERMISSIONS, isRole, type Role } from "../shared/permissions";
import type { CurrentUser, TeamMember } from "../shared/types";
import type { SessionClaims } from "./auth";
import type { Sql } from "./db";
import type { Env, WorkerContext } from "./env";
import { HttpError } from "./http";

type UserRow = {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

const USER_COLUMNS = `
  id, clerk_user_id, email, full_name, role::text AS role, is_active,
  to_char(last_seen_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_seen_at,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
`;

/**
 * Returns the signed-in user's dashboard profile, creating it on first visit.
 *
 * Role for a brand-new user:
 *   - SUPER_ADMIN if their email is listed in ADMIN_EMAILS
 *   - SUPER_ADMIN if nobody is a Super admin yet (the first person in)
 *   - SUPPORT otherwise (least access) until an admin promotes them
 */
export async function resolveCurrentUser(
  sql: Sql,
  env: Env,
  ctx: WorkerContext,
  claims: SessionClaims,
): Promise<CurrentUser> {
  let [row] = await sql<UserRow>(
    `SELECT ${USER_COLUMNS} FROM admin_users WHERE clerk_user_id = $1`,
    [claims.userId],
  );

  if (!row) {
    row = await provisionUser(sql, env, claims);
  }

  // Emails in ADMIN_EMAILS are always active Super admins, so the owner
  // can never be locked out by a role change.
  if (isAdminEmail(env, row.email) && (row.role !== "SUPER_ADMIN" || !row.is_active)) {
    [row] = await sql<UserRow>(
      `UPDATE admin_users SET role = 'SUPER_ADMIN', is_active = true, updated_at = now()
       WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [row.id],
    );
  }

  if (!row.is_active) {
    throw new HttpError(
      403,
      "account_disabled",
      "Your access to this dashboard has been turned off. Ask an administrator to restore it.",
    );
  }

  ctx.waitUntil(
    sql(
      `UPDATE admin_users SET last_seen_at = now()
       WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes')`,
      [row.id],
    ).catch((error: unknown) => console.error("Could not update last_seen_at", error)),
  );

  const role: Role = isRole(row.role) ? row.role : "SUPPORT";

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  };
}

async function provisionUser(sql: Sql, env: Env, claims: SessionClaims): Promise<UserRow> {
  const profile = await fetchClerkProfile(env, claims);

  let role: Role = "SUPPORT";
  if (isAdminEmail(env, profile.email)) {
    role = "SUPER_ADMIN";
  } else {
    const [admins] = await sql<{ count: number }>(
      `SELECT count(*)::int AS count FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active`,
    );
    if (!admins || admins.count === 0) role = "SUPER_ADMIN";
  }

  const [row] = await sql<UserRow>(
    `INSERT INTO admin_users (clerk_user_id, email, full_name, role, last_seen_at)
     VALUES ($1, $2, $3, $4::user_role, now())
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = now()
     RETURNING ${USER_COLUMNS}`,
    [claims.userId, profile.email, profile.fullName, role],
  );
  return row;
}

type ClerkUserResponse = {
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};

async function fetchClerkProfile(
  env: Env,
  claims: SessionClaims,
): Promise<{ email: string; fullName: string | null }> {
  if (!env.CLERK_SECRET_KEY) {
    if (claims.email) return { email: claims.email, fullName: null };
    throw new HttpError(500, "config_error", "CLERK_SECRET_KEY is not configured.");
  }

  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(claims.userId)}`,
    { headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` } },
  );

  if (!response.ok) {
    if (claims.email) return { email: claims.email, fullName: null };
    throw new HttpError(503, "auth_unavailable", "Could not load your Clerk profile.");
  }

  const user = (await response.json()) as ClerkUserResponse;
  const primary =
    user.email_addresses?.find((entry) => entry.id === user.primary_email_address_id) ??
    user.email_addresses?.[0];
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return {
    email: primary?.email_address ?? claims.email ?? `${claims.userId}@users.clerk`,
    fullName: fullName || user.username || null,
  };
}

function isAdminEmail(env: Env, email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Team management (requires the team:manage permission)

function toTeamMember(row: UserRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: isRole(row.role) ? row.role : "SUPPORT",
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

export async function listTeam(sql: Sql): Promise<TeamMember[]> {
  const rows = await sql<UserRow>(
    `SELECT ${USER_COLUMNS} FROM admin_users
     ORDER BY CASE role WHEN 'SUPER_ADMIN' THEN 0 WHEN 'FINANCE' THEN 1 ELSE 2 END, created_at`,
  );
  return rows.map(toTeamMember);
}

export async function updateTeamMember(
  sql: Sql,
  env: Env,
  actor: CurrentUser,
  targetId: string,
  body: unknown,
): Promise<TeamMember> {
  const input = (body ?? {}) as { role?: unknown; isActive?: unknown };
  const nextRole = input.role;
  const nextActive = input.isActive;

  if (nextRole === undefined && nextActive === undefined) {
    throw new HttpError(400, "bad_request", "Send a role and/or isActive.");
  }
  if (nextRole !== undefined && !isRole(nextRole)) {
    throw new HttpError(400, "bad_request", "Role must be SUPER_ADMIN, FINANCE or SUPPORT.");
  }
  if (nextActive !== undefined && typeof nextActive !== "boolean") {
    throw new HttpError(400, "bad_request", "isActive must be true or false.");
  }

  const [target] = await sql<UserRow>(
    `SELECT ${USER_COLUMNS} FROM admin_users WHERE id = $1`,
    [targetId],
  );
  if (!target) {
    throw new HttpError(404, "not_found", "That team member does not exist.");
  }

  if (target.id === actor.id) {
    throw new HttpError(400, "cannot_edit_self", "You cannot change your own role or access.");
  }

  const losesAdmin =
    target.role === "SUPER_ADMIN" &&
    target.is_active &&
    ((nextRole !== undefined && nextRole !== "SUPER_ADMIN") || nextActive === false);

  if (losesAdmin && isAdminEmail(env, target.email)) {
    throw new HttpError(
      400,
      "protected_admin",
      "This person is listed in ADMIN_EMAILS and always stays a Super admin.",
    );
  }

  if (losesAdmin) {
    const [admins] = await sql<{ count: number }>(
      `SELECT count(*)::int AS count FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active`,
    );
    if ((admins?.count ?? 0) <= 1) {
      throw new HttpError(400, "last_admin", "There must always be at least one Super admin.");
    }
  }

  const [updated] = await sql<UserRow>(
    `UPDATE admin_users
       SET role = COALESCE($2::user_role, role),
           is_active = COALESCE($3::boolean, is_active),
           updated_at = now()
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [targetId, nextRole ?? null, nextActive ?? null],
  );
  return toTeamMember(updated);
}
