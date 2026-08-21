import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCustomers } from '../lib/customerApi';
import { Pagination } from '../components/ui/Pagination';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CustomerDetailModal } from '../components/customers/CustomerDetailModal';
import type { Customer } from '../types/pos';

const TYPES = ['WALK_IN', 'REGISTERED', 'CREDIT'] as const;

export default function Customers() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('customers.manage');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | 'new' | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const result = await fetchCustomers(params);
      setCustomers(result.items);
      setTotalPages(result.totalPages);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canManage) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Customers</h1>
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          Your role doesn't include permission to view customers.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Customers</h1>
      <p className="mt-1 text-ink/60">Registered and credit customers, loyalty points, and purchase history.</p>

      <div className="mt-6 rounded-xl border border-ink/10 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-ink/10 p-4">
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search name or phone…"
            className="w-64 rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
          />
          <select
            value={typeFilter}
            onChange={(e) => {
              setPage(1);
              setTypeFilter(e.target.value);
            }}
            className="rounded-md border border-ink/15 px-2 py-2 text-sm"
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={() => setEditingCustomer('new')}
            className="ml-auto rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700"
          >
            Add customer
          </button>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Points</th>
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
            {!isLoading && customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/40">
                  No customers match those filters.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-paper/60" onClick={() => setViewingId(c.id)}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{c.name}</p>
                  {c.phone && <p className="figure text-xs text-ink/40">{c.phone}</p>}
                </td>
                <td className="px-4 py-3 text-ink/60">{c.type}</td>
                <td className="figure px-4 py-3 text-right text-ink/70">{c.loyaltyPoints}</td>
                <td
                  className={`figure px-4 py-3 text-right font-medium ${
                    Number(c.balance?.outstandingBalance ?? 0) > 0 ? 'text-brick-600' : 'text-ledger-700'
                  }`}
                >
                  {Number(c.balance?.outstandingBalance ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomer(c);
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

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {editingCustomer && (
        <CustomerFormModal
          customer={editingCustomer === 'new' ? null : editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={() => {
            setEditingCustomer(null);
            load();
          }}
        />
      )}

      {viewingId && (
        <CustomerDetailModal
          customerId={viewingId}
          onClose={() => {
            setViewingId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
