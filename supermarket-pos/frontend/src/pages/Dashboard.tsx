import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { SalesChart, ReportData } from "./Reports";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardSummary } from "../lib/inventoryApi";
import type { DashboardSummary } from "../types/inventory";

export default function Dashboard() {
  const { user } = useAuth();
  const [trend, setTrend] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    fetchDashboardSummary()
      .then(setSummary)
      .catch((e) => setError(e.message));
    if (user?.permissions.includes("reports.view")) {
      const to = new Date(),
        from = new Date();
      from.setUTCDate(from.getUTCDate() - 13);
      apiRequest<ReportData>(
        `/reports?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`,
      )
        .then(setTrend)
        .catch((e) => setError(e.message));
    }
  }, []);

  const metrics: { label: string; value: string | null }[] = [
    {
      label: "Today's sales",
      value: summary ? Number(summary.todaySalesTotal).toFixed(2) : null,
    },
    {
      label: "Transactions",
      value: summary ? String(summary.todayTransactionCount) : null,
    },
    {
      label: "Low stock items",
      value: summary ? String(summary.lowStockCount) : null,
    },
    {
      label: "Pending payments",
      value: summary ? Number(summary.pendingPayments).toFixed(2) : null,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">
        Welcome back, {user?.name?.split(" ")[0]}
      </h1>
      <p className="mt-1 text-ink/60">
        Signed in as <span className="font-medium text-ink">{user?.role}</span>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-ink/10 bg-white p-5"
          >
            <p className="text-sm text-ink/50">{m.label}</p>
            <p
              className={`figure mt-2 text-2xl font-semibold ${m.value !== null ? "text-ink" : "text-ink/20"}`}
            >
              {m.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 text-red-700">
          {error}
        </p>
      )}
      {trend && (
        <div className="mt-8">
          <SalesChart rows={trend.rows} />
        </div>
      )}
    </div>
  );
}
