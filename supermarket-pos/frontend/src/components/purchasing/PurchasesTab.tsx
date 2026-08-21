import { useCallback, useEffect, useState } from 'react';
import { fetchPurchases } from '../../lib/purchasingApi';
import { StatusBadge } from '../ui/StatusBadge';
import { Pagination } from '../ui/Pagination';
import { PurchaseFormModal } from './PurchaseFormModal';
import { PurchaseDetailModal } from './PurchaseDetailModal';
import type { Purchase, PurchaseStatus } from '../../types/purchasing';

const STATUSES: PurchaseStatus[] = ['ORDERED', 'RECEIVED', 'INVOICED', 'PAID', 'CANCELLED'];

export function PurchasesTab() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const result = await fetchPurchases(params);
      setPurchases(result.items);
      setTotalPages(result.totalPages);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-ink/10 p-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded-md border border-ink/15 px-2 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700"
        >
          New purchase order
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
          <tr>
            <th className="px-4 py-3 font-medium">PO number</th>
            <th className="px-4 py-3 font-medium">Supplier</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {isLoading && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink/40">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && purchases.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink/40">
                No purchase orders match that filter.
              </td>
            </tr>
          )}
          {purchases.map((p) => (
            <tr key={p.id} className="cursor-pointer hover:bg-paper/60" onClick={() => setViewingId(p.id)}>
              <td className="figure px-4 py-3 font-medium text-ink">{p.purchaseNumber}</td>
              <td className="px-4 py-3 text-ink/60">{p.supplier.name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="figure px-4 py-3 text-right text-ink">{Number(p.total).toFixed(2)}</td>
              <td className="px-4 py-3 text-ink/50">{new Date(p.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {showForm && (
        <PurchaseFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {viewingId && <PurchaseDetailModal purchaseId={viewingId} onClose={() => setViewingId(null)} onChanged={load} />}
    </div>
  );
}
