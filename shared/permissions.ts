// Roles and permissions shared by the API (worker/) and the UI (src/).
// The API is the source of truth: it checks these on every request.
// The UI uses the same table only to decide what to show.

export const ROLES = ["SUPER_ADMIN", "FINANCE", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard:view", // subscription counts, statuses, recent subscriptions
  "finance:view", // revenue, expenses, profit, payables
  "finance:export", // download the CSV report
  "team:manage", // change other users' roles or disable them
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ["dashboard:view", "finance:view", "finance:export", "team:manage"],
  FINANCE: ["dashboard:view", "finance:view", "finance:export"],
  SUPPORT: ["dashboard:view"],
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  FINANCE: "Finance",
  SUPPORT: "Support",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: "Everything, plus managing the team and their roles.",
  FINANCE: "All financial figures and the CSV export.",
  SUPPORT: "Subscriptions only. Money figures are hidden.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
