import { RefObject, useMemo } from 'react';
import { computeCartTotals } from '../../lib/cartMath';
import type { CartLine, PaymentMethod } from '../../types/pos';

export interface PaymentLine {
  method: PaymentMethod;
  amount: string;
}

interface Props {
  lines: CartLine[];
  cartDiscount: string;
  onCartDiscountChange: (value: string) => void;
  payments: PaymentLine[];
  onPaymentsChange: (payments: PaymentLine[]) => void;
  onHold: () => void;
  onClear: () => void;
  onComplete: () => void;
  isSubmitting: boolean;
  firstPaymentInputRef: RefObject<HTMLInputElement>;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'MOBILE_WALLET', label: 'Mobile wallet' },
  { value: 'CREDIT', label: 'Credit' },
];

export function CartSummary({
  lines,
  cartDiscount,
  onCartDiscountChange,
  payments,
  onPaymentsChange,
  onHold,
  onClear,
  onComplete,
  isSubmitting,
  firstPaymentInputRef,
}: Props) {
  const totals = useMemo(() => computeCartTotals(lines, cartDiscount), [lines, cartDiscount]);
  const tendered = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, totals.total - tendered);
  const change = Math.max(0, tendered - totals.total);
  // A small epsilon absorbs floating-point noise in this preview sum — the
  // backend's Decimal comparison is the real gate, this just avoids the
  // button flickering disabled/enabled on a value like 799.9999999999999.
  const canComplete = lines.length > 0 && tendered >= totals.total - 0.005;

  function updateLine(index: number, patch: Partial<PaymentLine>) {
    onPaymentsChange(payments.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addLine() {
    const used = new Set(payments.map((p) => p.method));
    const next = PAYMENT_METHODS.find((m) => !used.has(m.value))?.value ?? 'CARD';
    onPaymentsChange([...payments, { method: next, amount: remaining > 0 ? remaining.toFixed(2) : '' }]);
  }

  function removeLine(index: number) {
    if (payments.length === 1) return;
    onPaymentsChange(payments.filter((_, i) => i !== index));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <Row label="Subtotal" value={totals.subtotal} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink/60">Discount</span>
          <input
            value={cartDiscount}
            onChange={(e) => onCartDiscountChange(e.target.value)}
            placeholder="0.00"
            className="figure w-24 rounded border border-ink/15 py-1 text-right"
          />
        </div>
        <Row label="Tax" value={totals.tax} />
        <div className="flex items-center justify-between border-t border-ink/10 pt-3 text-base font-semibold text-ink">
          <span className="font-sans">Total</span>
          <span className="figure">{totals.total.toFixed(2)}</span>
        </div>

        <div className="pt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-ink/80">Payment (F5)</span>
            {payments.length < PAYMENT_METHODS.length && (
              <button onClick={addLine} className="text-xs font-medium text-ledger-600 hover:text-ledger-700">
                + Split payment
              </button>
            )}
          </div>
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={p.method}
                  onChange={(e) => updateLine(i, { method: e.target.value as PaymentMethod })}
                  className="rounded-md border border-ink/15 px-2 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  ref={i === 0 ? firstPaymentInputRef : undefined}
                  value={p.amount}
                  onChange={(e) => updateLine(i, { amount: e.target.value })}
                  placeholder="0.00"
                  className="figure w-full rounded-md border border-ink/15 px-2 py-2 text-right text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
                />
                {payments.length > 1 && (
                  <button onClick={() => removeLine(i)} className="text-ink/30 hover:text-brick-600" aria-label="Remove payment">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-ink/60">{remaining > 0 ? 'Remaining' : 'Change due'}</span>
            <span className={`figure font-semibold ${remaining > 0 ? 'text-brick-600' : 'text-ledger-700'}`}>
              {(remaining > 0 ? remaining : change).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-ink/10 p-4">
        <button
          onClick={onComplete}
          disabled={!canComplete || isSubmitting}
          className="w-full rounded-md bg-ledger-600 px-4 py-3 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Completing…' : 'Complete sale (F8)'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onHold}
            disabled={lines.length === 0}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-40"
          >
            Hold bill (F4)
          </button>
          <button
            onClick={onClear}
            disabled={lines.length === 0}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-40"
          >
            Clear (F2)
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink/60">{label}</span>
      <span className="figure text-ink">{value.toFixed(2)}</span>
    </div>
  );
}
