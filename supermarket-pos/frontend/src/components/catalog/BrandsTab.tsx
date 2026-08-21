import { FormEvent, useEffect, useState } from 'react';
import { fetchBrands, createBrand, updateBrand, deleteBrand } from '../../lib/catalogApi';
import type { Brand } from '../../types/catalog';
import { ApiError } from '../../lib/api';

export function BrandsTab() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBrands(await fetchBrands());
  }

  useEffect(() => {
    load().catch(() => setError('Could not load brands'));
  }, []);

  function reset() {
    setEditingId(null);
    setName('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) await updateBrand(editingId, { name });
      else await createBrand({ name });
      reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save brand');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteBrand(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete brand');
    }
  }

  return (
    <div className="p-4">
      {error && <div className="mb-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
          />
        </label>
        <button type="submit" className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700">
          {editingId ? 'Update' : 'Add brand'}
        </button>
        {editingId && (
          <button type="button" onClick={reset} className="text-sm text-ink/50 hover:text-ink">
            Cancel
          </button>
        )}
      </form>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
          <tr>
            <th className="py-2 font-medium">Name</th>
            <th className="figure py-2 text-right font-medium">Products</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {brands.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-ink/40">
                No brands yet.
              </td>
            </tr>
          )}
          {brands.map((b) => (
            <tr key={b.id}>
              <td className="py-2 font-medium text-ink">{b.name}</td>
              <td className="figure py-2 text-right text-ink/50">{b._count?.products ?? 0}</td>
              <td className="py-2 text-right">
                <button
                  onClick={() => {
                    setEditingId(b.id);
                    setName(b.name);
                  }}
                  className="text-sm font-medium text-ledger-600 hover:text-ledger-700"
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(b.id)} className="ml-3 text-sm font-medium text-ink/40 hover:text-brick-600">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
