import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, ShieldCheck, UserX, X } from "lucide-react";

import {
  PERMISSIONS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  can,
  type Permission,
  type Role,
} from "../../shared/permissions";
import type { CurrentUser, TeamMember } from "../../shared/types";
import { useApi } from "../lib/api";
import { formatRelative } from "../lib/format";

const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard:view": "See subscriptions",
  "finance:view": "See money figures",
  "finance:export": "Export CSV",
  "team:manage": "Manage team",
};

export function TeamPage({ currentUser }: { currentUser: CurrentUser }) {
  const api = useApi();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await api<TeamMember[]>("/api/team"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(member: TeamMember, changes: { role?: Role; isActive?: boolean }) {
    setSavingId(member.id);
    setNotice(null);
    try {
      const updated = await api<TeamMember>(`/api/team/${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setMembers((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setNotice(
        changes.role
          ? `${updated.email} is now ${ROLE_LABELS[updated.role]}.`
          : `${updated.email} ${updated.isActive ? "can sign in again" : "no longer has access"}.`,
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save the change.");
      void load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">Team & roles</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Everyone who signs in appears here. New people start as <strong>Support</strong> (no money
          figures) until you give them a role. Roles are checked by the server on every request.
        </p>
      </div>

      {/* Permission matrix */}
      <section className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
          <ShieldCheck size={20} /> What each role can do
        </h2>
        <table className="mt-4 w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-semibold">Role</th>
              {PERMISSIONS.map((permission) => (
                <th key={permission} className="py-2 pr-4 text-center font-semibold">
                  {PERMISSION_LABELS[permission]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b border-slate-300 last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-semibold text-slate-900">{ROLE_LABELS[role]}</p>
                  <p className="text-xs text-slate-600">{ROLE_DESCRIPTIONS[role]}</p>
                </td>
                {PERMISSIONS.map((permission) => (
                  <td key={permission} className="py-3 pr-4 text-center">
                    {can(role, permission) ? (
                      <Check size={18} className="inline text-emerald-700" aria-label="Allowed" />
                    ) : (
                      <X size={18} className="inline text-slate-400" aria-label="Not allowed" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {notice && (
        <div className="rounded-xl border border-slate-300 bg-slate-200 px-4 py-3 text-sm text-slate-800" role="status">
          {notice}
        </div>
      )}

      {/* Members */}
      <section className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Members {members && <span className="text-slate-500">({members.length})</span>}
        </h2>

        {error && <p className="mt-4 text-sm text-rose-800">{error}</p>}

        {!members && !error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <LoaderCircle size={16} className="animate-spin" /> Loading team...
          </p>
        )}

        {members && (
          <ul className="mt-4 divide-y divide-slate-300">
            {members.map((member) => {
              const isSelf = member.id === currentUser.id;
              const saving = savingId === member.id;
              return (
                <li
                  key={member.id}
                  className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${
                    member.isActive ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-200 font-display text-sm font-bold text-slate-700">
                      {(member.fullName ?? member.email).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {member.fullName ?? member.email}
                        {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>}
                        {!member.isActive && (
                          <span className="ml-2 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                            No access
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-600">
                        {member.email} · last seen {formatRelative(member.lastSeenAt).toLowerCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    {saving && <LoaderCircle size={16} className="animate-spin text-slate-500" />}
                    <label className="sr-only" htmlFor={`role-${member.id}`}>
                      Role for {member.email}
                    </label>
                    <select
                      id={`role-${member.id}`}
                      value={member.role}
                      disabled={isSelf || saving}
                      onChange={(event) => void update(member, { role: event.target.value as Role })}
                      className="h-10 flex-1 rounded-xl border border-slate-300 bg-slate-200 px-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isSelf || saving}
                      onClick={() => void update(member, { isActive: !member.isActive })}
                      className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-slate-200 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                      title={member.isActive ? "Turn off this person's access" : "Restore access"}
                    >
                      {member.isActive ? <UserX size={16} /> : <Check size={16} />}
                      {member.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
