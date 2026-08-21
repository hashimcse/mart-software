import { useCallback, useEffect, useState } from 'react';
import { fetchSuppliers } from '../../lib/purchasingApi';
import { SupplierFormModal } from './SupplierFormModal';
import { SupplierDetailModal } from './SupplierDetailModal';
import type { Supplier } from '../../types/purchasing';

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | 'new' | null>(null);
  const [viewingSupplierId, setViewingSupplierId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search) params.set('search', search);
      const result = await fetchSuppliers(params);
      setSuppliers(result.items);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-ink/10 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="w-64 rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
        />
        <button
          onClick={() => setEditingSupplier('new')}
          className="ml-auto rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700"
        >
          Add supplier
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
          <tr>
            <th className="px-4 py-3 font-medium">Supplier</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 text-right font-medium">Purchased</th>
            <th className="px-4 py-3 text-right font-medium">Outstanding</th>
            <th className="px-4 py-3"></th>
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
          {!isLoading && suppliers.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink/40">
                No suppliers match that search.
              </td>
            </tr>
          )}
          {suppliers.map((s) => (
            <tr key={s.id} className="cursor-pointer hover:bg-paper/60" onClick={() => setViewingSupplierId(s.id)}>
              <td className="px-4 py-3">
                <p className="font-medium text-ink">{s.name}</p>
                {s.company && <p className="text-xs text-ink/40">{s.company}</p>}
              </td>
              <td className="px-4 py-3 text-ink/60">{s.phone ?? s.email ?? '—'}</td>
              <td className="figure px-4 py-3 text-right text-ink/70">{Number(s.balance?.totalPurchases ?? 0).toFixed(2)}</td>
              <td
                className={`figure px-4 py-3 text-right font-medium ${
                  Number(s.balance?.outstandingBalance ?? 0) > 0 ? 'text-brick-600' : 'text-ledger-700'
                }`}
              >
                {Number(s.balance?.outstandingBalance ?? 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSupplier(s);
                  }}
                  className="text-sm font-medium text-ledger-600 hover:text-ledger-700"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingSupplier && (
        <SupplierFormModal
          supplier={editingSupplier === 'new' ? null : editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSaved={() => {
            setEditingSupplier(null);
            load();
          }}
        />
      )}

      {viewingSupplierId && (
        <SupplierDetailModal supplierId={viewingSupplierId} onClose={() => { setViewingSupplierId(null); load(); }} />
      )}
    </div>
  );
}
