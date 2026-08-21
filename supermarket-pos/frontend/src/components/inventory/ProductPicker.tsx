import { useEffect, useRef, useState } from 'react';
import { searchProducts } from '../../lib/posApi';
import type { Product } from '../../types/catalog';

interface Props {
  selected: Product | null;
  onSelect: (product: Product | null) => void;
}

export function ProductPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchProducts(query.trim())
        .then((r) => setResults(r.items))
        .catch(() => {});
    }, 250);
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-ink/15 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-ink">{selected.name}</p>
          <p className="figure text-xs text-ink/40">
            {selected.sku} · in stock: {selected.currentStock} {selected.unit.abbreviation}
          </p>
        </div>
        <button onClick={() => onSelect(null)} className="text-xs font-medium text-ink/40 hover:text-brick-600">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search product by name, SKU or barcode…"
        className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-ink/10 bg-white shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p);
                setQuery('');
                setResults([]);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <span className="font-medium text-ink">{p.name}</span>
              <span className="figure text-ink/40">
                {p.currentStock} {p.unit.abbreviation}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
