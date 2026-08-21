import { useCallback, useEffect, useState } from 'react';
import { fetchProducts, fetchCategories, fetchBrands, setProductStatus } from '../../lib/catalogApi';
import { assetUrl, ApiError } from '../../lib/api';
import type { Product, Category, Brand } from '../../types/catalog';
import { StatusBadge } from '../ui/StatusBadge';
import { Pagination } from '../ui/Pagination';
import { ProductFormModal } from './ProductFormModal';

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      if (brandId) params.set('brandId', brandId);
      const result = await fetchProducts(params);
      setProducts(result.items);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load products');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, categoryId, brandId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    fetchBrands().then(setBrands).catch(() => {});
  }, []);

  async function handleToggleStatus(product: Product) {
    const next = product.status === 'DISCONTINUED' ? 'ACTIVE' : 'DISCONTINUED';
    try {
      await setProductStatus(product.id, next);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update status');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-ink/10 p-4">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search name, SKU or barcode…"
          className="w-64 rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
        />
        <select
          value={categoryId}
          onChange={(e) => {
            setPage(1);
            setCategoryId(e.target.value);
          }}
          className="rounded-md border border-ink/15 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={brandId}
          onChange={(e) => {
            setPage(1);
            setBrandId(e.target.value);
          }}
          className="rounded-md border border-ink/15 px-3 py-2 text-sm"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setEditingProduct('new')}
          className="ml-auto rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700"
        >
          Add product
        </button>
      </div>

      {error && <div className="m-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU / Barcode</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/40">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/40">
                  No products match those filters.
                </td>
              </tr>
            )}
            {!isLoading &&
              products.map((p) => (
                <tr key={p.id} className="hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper text-xs text-ink/30">
                        {p.imageUrl ? (
                          <img src={assetUrl(p.imageUrl)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          '—'
                        )}
                      </div>
                      <span className="font-medium text-ink">{p.name}</span>
                    </div>
                  </td>
                  <td className="figure px-4 py-3 text-ink/60">
                    {p.sku}
                    {p.barcode && <div className="text-ink/40">{p.barcode}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{p.category?.name ?? '—'}</td>
                  <td className="figure px-4 py-3 text-right text-ink">{Number(p.sellingPrice).toFixed(2)}</td>
                  <td className="figure px-4 py-3 text-right text-ink/70">
                    {Number(p.currentStock).toFixed(p.isWeighted ? 3 : 0)} {p.unit?.abbreviation}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditingProduct(p)} className="text-sm font-medium text-ledger-600 hover:text-ledger-700">
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(p)}
                      className="ml-3 text-sm font-medium text-ink/40 hover:text-brick-600"
                    >
                      {p.status === 'DISCONTINUED' ? 'Reactivate' : 'Discontinue'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {editingProduct && (
        <ProductFormModal
          product={editingProduct === 'new' ? null : editingProduct}
          categories={categories}
          brands={brands}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            load();
          }}
        />
      )}
    </div>
  );
}
