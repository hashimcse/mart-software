import { useEffect, useState } from 'react';
import { fetchMovements } from '../../lib/inventoryApi';
import { Pagination } from '../ui/Pagination';
import type { InventoryMovement, MovementType } from '../../types/inventory';

const TYPE_STYLES: Record<string, string> = {
  SALE: 'bg-ink/5 text-ink/60',
  PURCHASE: 'bg-ledger-50 text-ledger-700',
  ADJUSTMENT: 'bg-brass-50 text-brass-600',
  RETURN: 'bg-ledger-50 text-ledger-700',
  DAMAGED: 'bg-brick-50 text-brick-600',
  EXPIRED: 'bg-brick-50 text-brick-600',
};

const TYPES: MovementType[] = ['SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'DAMAGED', 'EXPIRED'];

export function HistoryTab() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (typeFilter) params.set('type', typeFilter);
    fetchMovements(params)
      .then((r) => {
        setMovements(r.items);
        setTotalPages(r.totalPages);
      })
      .finally(() => setIsLoading(false));
  }, [page, typeFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-ink/10 p-4">
        <select
          value={typeFilter}
          onChange={(e) => {
            setPage(1);
            setTypeFilter(e.target.value);
          }}
          className="rounded-md border border-ink/15 px-2 py-2 text-sm"
        >
          <option value="">All movement types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">Change</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">By</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/40">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/40">
                  No movements match that filter.
                </td>
              </tr>
            )}
            {movements.map((m) => {
              const qty = Number(m.quantity);
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{m.product.name}</p>
                    <p className="figure text-xs text-ink/40">{m.product.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[m.type] ?? 'bg-ink/5 text-ink/60'}`}>
                      {m.type}
                    </span>
                  </td>
                  <td className={`figure px-4 py-2.5 text-right font-medium ${qty < 0 ? 'text-brick-600' : 'text-ledger-700'}`}>
                    {qty > 0 ? '+' : ''}
                    {m.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-ink/60">{m.reason ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink/60">{m.user?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink/50">{new Date(m.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
