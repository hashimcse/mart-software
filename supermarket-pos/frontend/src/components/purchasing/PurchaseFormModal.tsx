import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { ProductPicker } from '../inventory/ProductPicker';
import { fetchSuppliers, createPurchase } from '../../lib/purchasingApi';
import { ApiError } from '../../lib/api';
import type { Product } from '../../types/catalog';
import type { Supplier } from '../../types/purchasing';

interface Line {
  product: Product | null;
  quantity: string;
  unitCost: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function PurchaseFormModal({ onClose, onSaved }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product: null, quantity: '1', unitCost: '' }]);
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSuppliers(new URLSearchParams({ pageSize: '100' }))
      .then((r) => setSuppliers(r.items))
      .catch(() => {});
  }, []);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        if (!l.product || !l.quantity || !l.unitCost) return sum;
        return sum + Number(l.quantity) * Number(l.unitCost);
      }, 0),
    [lines],
  );
  const total = subtotal + (Number(taxAmount) || 0);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { product: null, quantity: '1', unitCost: '' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validLines = lines.filter((l) => l.product && l.quantity && l.unitCost);
    if (!supplierId || validLines.length === 0) {
      setError('Pick a supplier and at least one product with a quantity and unit cost.');
      return;
    }

    setIsSaving(true);
    try {
      await createPurchase({
        supplierId,
        items: validLines.map((l) => ({ productId: l.product!.id, quantity: l.quantity, unitCost: l.unitCost })),
        taxAmount: taxAmount || '0.00',
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this purchase order.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title="New purchase order" onClose={onClose} widthClass="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">
            Supplier <span className="text-brick-500">*</span>
          </span>
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="">Select a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-ink/80">Items</span>
            <button type="button" onClick={addLine} className="text-xs font-medium text-ledger-600 hover:text-ledger-700">
              + Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <ProductPicker selected={line.product} onSelect={(p) => updateLine(i, { product: p })} />
                </div>
                <input
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  placeholder="Qty"
                  className="figure w-20 rounded-md border border-ink/15 px-2 py-2 text-sm"
                />
                <input
                  value={line.unitCost}
                  onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                  placeholder="Unit cost"
                  className="figure w-24 rounded-md border border-ink/15 px-2 py-2 text-sm"
                />
                {lines.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="mt-2 text-ink/30 hover:text-brick-600" aria-label="Remove line">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink/80">Tax amount</span>
            <input
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
              className="figure w-24 rounded-md border border-ink/15 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="text-right text-sm">
            <p className="text-ink/50">
              Subtotal <span className="figure ml-2 text-ink">{subtotal.toFixed(2)}</span>
            </p>
            <p className="font-semibold text-ink">
              Total <span className="figure ml-2">{total.toFixed(2)}</span>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-60"
          >
            {isSaving ? 'Creating…' : 'Create purchase order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
