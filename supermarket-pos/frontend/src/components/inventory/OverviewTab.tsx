import { useEffect, useState } from 'react';
import { fetchLowStock, fetchOutOfStock, fetchExpiring, fetchValuation } from '../../lib/inventoryApi';
import type { AlertProduct, Valuation } from '../../types/inventory';

export function OverviewTab() {
  const [lowStock, setLowStock] = useState<AlertProduct[]>([]);
  const [outOfStock, setOutOfStock] = useState<AlertProduct[]>([]);
  const [expiring, setExpiring] = useState<AlertProduct[]>([]);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchLowStock(), fetchOutOfStock(), fetchExpiring(), fetchValuation().catch(() => null)])
      .then(([low, out, exp, val]) => {
        setLowStock(low);
        setOutOfStock(out);
        setExpiring(exp);
        setValuation(val);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="p-8 text-sm text-ink/40">Loading…</div>;

  return (
    <div className="space-y-6 p-4">
      {valuation && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Stock value (cost)" value={valuation.totalCost} />
          <StatCard label="Stock value (retail)" value={valuation.totalRetail} />
          <StatCard label="Potential profit" value={valuation.potentialProfit} />
        </div>
      )}

      <AlertList title="Out of stock" products={outOfStock} tone="brick" empty="Nothing is out of stock." />
      <AlertList title="Low stock" products={lowStock} tone="brass" empty="Nothing is below its minimum stock level." />
      <AlertList title="Expiring within 14 days" products={expiring} tone="brass" empty="Nothing is expiring soon." showExpiry />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="figure mt-1 text-xl font-semibold text-ink">
        {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function AlertList({
  title,
  products,
  tone,
  empty,
  showExpiry,
}: {
  title: string;
  products: AlertProduct[];
  tone: 'brick' | 'brass';
  empty: string;
  showExpiry?: boolean;
}) {
  const badgeClass = tone === 'brick' ? 'bg-brick-50 text-brick-600' : 'bg-brass-50 text-brass-600';
  return (
    <div className="rounded-xl border border-ink/10 bg-white">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        <span className={`figure rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{products.length}</span>
      </div>
      {products.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink/40">{empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-ink/5">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 font-medium text-ink">{p.name}</td>
                <td className="figure px-4 py-2.5 text-ink/40">{p.sku}</td>
                <td className="figure px-4 py-2.5 text-right text-ink/70">
                  {p.currentStock} {p.unit.abbreviation}
                  {!showExpiry && <span className="text-ink/40"> / min {p.minStock}</span>}
                </td>
                {showExpiry && (
                  <td className="figure px-4 py-2.5 text-right text-brick-600">
                    {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
