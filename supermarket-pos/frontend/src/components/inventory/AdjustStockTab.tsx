import { FormEvent, useState } from 'react';
import { ProductPicker } from './ProductPicker';
import { submitAdjustment, submitDamaged, submitExpired } from '../../lib/inventoryApi';
import { ApiError } from '../../lib/api';
import type { Product } from '../../types/catalog';

type Mode = 'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED';

const MODE_LABELS: Record<Mode, string> = {
  ADJUSTMENT: 'Stock adjustment',
  DAMAGED: 'Damaged',
  EXPIRED: 'Expired',
};

export function AdjustStockTab() {
  const [mode, setMode] = useState<Mode>('ADJUSTMENT');
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product || !quantity) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      if (mode === 'ADJUSTMENT') {
        const signedQty = direction === 'increase' ? quantity : `-${quantity}`;
        await submitAdjustment({ productId: product.id, quantityChange: signedQty, reason });
      } else if (mode === 'DAMAGED') {
        await submitDamaged({ productId: product.id, quantity, reason: reason || undefined });
      } else {
        await submitExpired({ productId: product.id, quantity, reason: reason || undefined });
      }
      setSuccess(`Stock updated for ${product.name}.`);
      setProduct(null);
      setQuantity('');
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update stock');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              mode === m ? 'border-ledger-600 bg-ledger-50 text-ledger-700' : 'border-ink/15 text-ink/60 hover:bg-paper'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}
      {success && <div className="mb-4 rounded-md bg-ledger-50 px-3 py-2 text-sm text-ledger-700">{success}</div>}

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-ink/80">Product</span>
          <ProductPicker selected={product} onSelect={setProduct} />
        </div>

        {mode === 'ADJUSTMENT' && (
          <div>
            <span className="mb-1 block text-sm font-medium text-ink/80">Direction</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('increase')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  direction === 'increase' ? 'border-ledger-600 bg-ledger-50 text-ledger-700' : 'border-ink/15 text-ink/60'
                }`}
              >
                Increase
              </button>
              <button
                type="button"
                onClick={() => setDirection('decrease')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  direction === 'decrease' ? 'border-ledger-600 bg-ledger-50 text-ledger-700' : 'border-ink/15 text-ink/60'
                }`}
              >
                Decrease
              </button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">Quantity</span>
          <input
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={product?.isWeighted ? '0.500' : '1'}
            className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">
            Reason {mode === 'ADJUSTMENT' && <span className="text-brick-500">*</span>}
          </span>
          <input
            required={mode === 'ADJUSTMENT'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === 'DAMAGED'
                ? 'e.g. dropped, broken packaging'
                : mode === 'EXPIRED'
                  ? 'e.g. past sell-by date'
                  : 'e.g. stock count correction'
            }
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={!product || !quantity || isSubmitting}
          className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Record'}
        </button>
      </form>
    </div>
  );
}
