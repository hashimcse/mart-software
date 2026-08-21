import { FormEvent, useEffect, useState } from 'react';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../../lib/catalogApi';
import type { Category } from '../../types/catalog';
import { ApiError } from '../../lib/api';

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setCategories(await fetchCategories());
  }

  useEffect(() => {
    load().catch(() => setError('Could not load categories'));
  }, []);

  function reset() {
    setEditingId(null);
    setName('');
    setParentId('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = { name, parentId: parentId || null };
      if (editingId) await updateCategory(editingId, payload);
      else await createCategory(payload);
      reset();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save category');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteCategory(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete category');
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setName(c.name);
    setParentId(c.parentId ?? '');
  }

  return (
    <div className="p-4">
      {error && <div className="mb-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">Parent category</span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="">None (top level)</option>
            {categories
              .filter((c) => c.id !== editingId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700">
          {editingId ? 'Update' : 'Add category'}
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
            <th className="py-2 font-medium">Parent</th>
            <th className="figure py-2 text-right font-medium">Products</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {categories.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-ink/40">
                No categories yet.
              </td>
            </tr>
          )}
          {categories.map((c) => (
            <tr key={c.id}>
              <td className="py-2 font-medium text-ink">{c.name}</td>
              <td className="py-2 text-ink/50">{categories.find((p) => p.id === c.parentId)?.name ?? '—'}</td>
              <td className="figure py-2 text-right text-ink/50">{c._count?.products ?? 0}</td>
              <td className="py-2 text-right">
                <button onClick={() => startEdit(c)} className="text-sm font-medium text-ledger-600 hover:text-ledger-700">
                  Edit
                </button>
                <button onClick={() => handleDelete(c.id)} className="ml-3 text-sm font-medium text-ink/40 hover:text-brick-600">
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
