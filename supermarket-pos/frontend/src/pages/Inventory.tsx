import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OverviewTab } from '../components/inventory/OverviewTab';
import { AdjustStockTab } from '../components/inventory/AdjustStockTab';
import { HistoryTab } from '../components/inventory/HistoryTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'adjust', label: 'Adjust stock' },
  { key: 'history', label: 'History' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Inventory() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<TabKey>('overview');
  const canView = hasPermission('inventory.manage') || hasPermission('reports.view');
  const canAdjust = hasPermission('inventory.adjust') || hasPermission('inventory.manage');

  if (!canView) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Inventory</h1>
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          Your role doesn't include permission to view inventory.
        </div>
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => t.key !== 'adjust' || canAdjust);

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Inventory</h1>
      <p className="mt-1 text-ink/60">Stock levels, adjustments, and the full movement ledger.</p>

      <div className="mt-6 rounded-xl border border-ink/10 bg-white">
        <div className="flex border-b border-ink/10 px-4">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                tab === t.key ? 'border-ledger-600 text-ledger-700' : 'border-transparent text-ink/50 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'adjust' && canAdjust && <AdjustStockTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}
