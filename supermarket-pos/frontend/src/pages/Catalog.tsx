import { useState } from 'react';
import { ProductsTab } from '../components/catalog/ProductsTab';
import { CategoriesTab } from '../components/catalog/CategoriesTab';
import { BrandsTab } from '../components/catalog/BrandsTab';

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Catalog() {
  const [tab, setTab] = useState<TabKey>('products');

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Catalog</h1>
      <p className="mt-1 text-ink/60">
        Products, categories and brands — the foundation everything else in the store references.
      </p>

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
        {tab === 'products' && <ProductsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'brands' && <BrandsTab />}
      </div>
    </div>
  );
}
