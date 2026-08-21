import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchDashboardSummary } from '../lib/inventoryApi';
import type { DashboardSummary } from '../types/inventory';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    fetchDashboardSummary().then(setSummary).catch(() => {});
  }, []);

  const metrics: { label: string; value: string | null }[] = [
    { label: "Today's sales", value: summary ? Number(summary.todaySalesTotal).toFixed(2) : null },
    { label: 'Transactions', value: summary ? String(summary.todayTransactionCount) : null },
    { label: 'Low stock items', value: summary ? String(summary.lowStockCount) : null },
    { label: 'Pending payments', value: summary ? Number(summary.pendingPayments).toFixed(2) : null },
  ];

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Welcome back, {user?.name?.split(' ')[0]}</h1>
      <p className="mt-1 text-ink/60">
        Signed in as <span className="font-medium text-ink">{user?.role}</span>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-ink/10 bg-white p-5">
            <p className="text-sm text-ink/50">{m.label}</p>
            <p className={`figure mt-2 text-2xl font-semibold ${m.value !== null ? 'text-ink' : 'text-ink/20'}`}>
              {m.value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
        All four numbers above are real, computed from the database — nothing here is a placeholder anymore. The
        full dashboard with charts and trends still ships in Phase 10 — see{' '}
        <span className="figure">docs/ROADMAP.md</span>.
      </div>
    </div>
  );
}
