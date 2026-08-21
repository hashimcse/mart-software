import { KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react';
import { lookupByBarcode, searchProducts } from '../../lib/posApi';
import { assetUrl, ApiError } from '../../lib/api';
import type { Product } from '../../types/catalog';

interface Props {
  inputRef: RefObject<HTMLInputElement>;
  onAdd: (product: Product) => void;
  onError: (message: string) => void;
}

// Most USB barcode scanners behave like a very fast keyboard: they type the
// barcode's digits and then Enter. This single input handles that, manual
// barcode entry, and free-text name/SKU search — spec section 4's "support
// scanner input" and "allow manual search" in one control, since a cashier
// shouldn't need to think about which mode they're in.
export function BarcodeSearchInput({ inputRef, onAdd, onError }: Props) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchProducts(value.trim())
        .then((result) => setResults(result.items))
        .catch(() => {
          // A search failure shouldn't interrupt scanning — the cashier can
          // still try an exact barcode via Enter.
        });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function reset() {
    setValue('');
    setResults([]);
    inputRef.current?.focus();
  }

  function selectProduct(product: Product) {
    onAdd(product);
    reset();
  }

  async function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const code = value.trim();
    if (!code) return;
    e.preventDefault();

    try {
      const product = await lookupByBarcode(code);
      selectProduct(product);
      return;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) {
        onError('Could not look up that barcode — check your connection.');
        return;
      }
      // 404 just means no exact barcode match; fall through to search results below.
    }

    if (results.length === 1) {
      selectProduct(results[0]);
    } else if (results.length > 1) {
      onError(`"${code}" matches ${results.length} products — pick one from the list below.`);
    } else {
      onError(`No product matches "${code}".`);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Scan barcode or search by name / SKU… (F1)"
        className="figure w-full rounded-md border border-ink/15 px-3 py-2.5 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-ink/10 bg-white shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProduct(p)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-paper text-[10px] text-ink/30">
                {p.imageUrl ? <img src={assetUrl(p.imageUrl)} alt="" className="h-full w-full object-cover" /> : '—'}
              </div>
              <span className="flex-1 truncate font-medium text-ink">{p.name}</span>
              <span className="figure text-ink/40">{Number(p.sellingPrice).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
