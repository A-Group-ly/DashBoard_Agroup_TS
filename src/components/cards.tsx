import type { RecentSubscription, SubscriptionStatus } from "../../shared/types";
import { formatDateTime, money } from "../lib/format";

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-emerald-300 bg-emerald-100 text-emerald-800",
  PENDING: "border-amber-300 bg-amber-100 text-amber-800",
  CANCELLED: "border-rose-300 bg-rose-100 text-rose-800",
  EXPIRED: "border-slate-300 bg-slate-200 text-slate-700",
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      className={`status-badge inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RecentSubscriptions({ items }: { items: RecentSubscription[] }) {
  const showAmount = items.some((item) => item.amount !== null);

  return (
    <section className="h-full rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">Latest subscriptions</h2>
      <p className="mt-1 text-sm text-slate-600">The most recent sign-ups, straight from the database.</p>

      {items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-300 bg-slate-200 p-4 text-sm text-slate-600">
          No subscriptions yet.
        </p>
      ) : (
        <>
          {/* Phones: stacked list */}
          <ul className="mt-4 divide-y divide-slate-300 md:hidden">
            {items.map((item) => (
              <li key={item.id} className="hover-row -mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.company}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {item.plan} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={item.status} />
                  {item.amount !== null && (
                    <span className="text-sm font-semibold text-slate-800">
                      {money(item.amount, item.currency)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Tablets and up: table */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pl-2 pr-4 font-semibold">Company</th>
                  <th className="py-2 pr-4 font-semibold">Plan</th>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Payment</th>
                  {showAmount && <th className="py-2 pr-2 text-right font-semibold">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="hover-row border-b border-slate-300 last:border-0">
                    <td className="py-3 pl-2 pr-4 font-semibold text-slate-900">{item.company}</td>
                    <td className="py-3 pr-4 text-slate-700">{item.plan}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{item.paid ? "Paid" : "Awaiting"}</td>
                    {showAmount && (
                      <td className="whitespace-nowrap py-3 pr-2 text-right font-semibold text-slate-900">
                        {item.amount !== null ? money(item.amount, item.currency) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
