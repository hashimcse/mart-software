import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PurchasesTab } from '../components/purchasing/PurchasesTab';
import { SuppliersTab } from '../components/purchasing/SuppliersTab';

const TABS = [
  { key: 'purchases', label: 'Purchase orders' },
  { key: 'suppliers', label: 'Suppliers' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Purchases() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<TabKey>('purchases');
  const canView = hasPermission('purchases.manage') || hasPermission('suppliers.manage');

  if (!canView) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Purchases</h1>
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          Your role doesn't include permission to view purchases or suppliers.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Purchases</h1>
      <p className="mt-1 text-ink/60">Purchase orders, receiving, supplier balances and payments.</p>

      <div className="mt-6 rounded-xl border border-ink/10 bg-white">
        <div className="flex border-b border-ink/10 px-4">
          {TABS.map((t) => (
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
        {tab === 'purchases' && <PurchasesTab />}
        {tab === 'suppliers' && <SuppliersTab />}
      </div>
    </div>
  );
}
