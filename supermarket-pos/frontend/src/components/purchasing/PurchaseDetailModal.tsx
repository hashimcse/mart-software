import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { fetchPurchase, receivePurchase, invoicePurchase, cancelPurchase, recordSupplierPayment } from '../../lib/purchasingApi';
import { ApiError } from '../../lib/api';
import type { PaymentMethod } from '../../types/pos';
import type { Purchase } from '../../types/purchasing';

interface Props {
  purchaseId: string;
  onClose: () => void;
  onChanged: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT'];

export function PurchaseDetailModal({ purchaseId, onClose, onChanged }: Props) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  function load() {
    fetchPurchase(purchaseId).then(setPurchase).catch(() => setError('Could not load this purchase order'));
  }

  useEffect(load, [purchaseId]);

  async function runAction(action: () => Promise<Purchase>) {
    setError(null);
    setIsActing(true);
    try {
      await action();
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That action could not be completed');
    } finally {
      setIsActing(false);
    }
  }

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    if (!purchase || !amount) return;
    setError(null);
    setIsActing(true);
    try {
      await recordSupplierPayment(purchase.supplierId, { amount, method, purchaseId: purchase.id });
      setAmount('');
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this payment');
    } finally {
      setIsActing(false);
    }
  }

  if (!purchase) {
    return (
      <Modal title="Purchase order" onClose={onClose}>
        <p className="text-sm text-ink/40">Loading…</p>
      </Modal>
    );
  }

  const paid = purchase.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, Number(purchase.total) - paid);

  return (
    <Modal title={purchase.purchaseNumber} onClose={onClose} widthClass="max-w-lg">
      {error && <div className="mb-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink/60">{purchase.supplier.name}</p>
          <p className="text-xs text-ink/40">{new Date(purchase.createdAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={purchase.status} />
      </div>

      <div className="figure mb-4 space-y-1 text-sm">
        {purchase.items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span className="font-sans text-ink/70">
              {item.product.name} × {item.quantity}
            </span>
            <span>{Number(item.subtotal).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-ink/10 pt-1 text-ink/60">
          <span className="font-sans">Subtotal</span>
          <span>{Number(purchase.subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-ink/60">
          <span className="font-sans">Tax</span>
          <span>{Number(purchase.taxAmount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold text-ink">
          <span className="font-sans">Total</span>
          <span>{Number(purchase.total).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-ink/60">
          <span className="font-sans">Paid</span>
          <span>{paid.toFixed(2)}</span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between font-semibold text-brick-600">
            <span className="font-sans">Remaining</span>
            <span>{remaining.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-t border-ink/10 pt-4">
        {purchase.status === 'ORDERED' && (
          <>
            <button
              onClick={() => runAction(() => receivePurchase(purchase.id))}
              disabled={isActing}
              className="rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
            >
              Receive stock
            </button>
            <button
              onClick={() => runAction(() => cancelPurchase(purchase.id))}
              disabled={isActing}
              className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-50"
            >
              Cancel order
            </button>
          </>
        )}
        {purchase.status === 'RECEIVED' && (
          <button
            onClick={() => runAction(() => invoicePurchase(purchase.id))}
            disabled={isActing}
            className="rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
          >
            Mark invoiced
          </button>
        )}
        {(purchase.status === 'RECEIVED' || purchase.status === 'INVOICED') && remaining === 0 && (
          <span className="rounded-md bg-ledger-50 px-3 py-2 text-sm font-medium text-ledger-700">Fully paid</span>
        )}
      </div>

      {purchase.status !== 'CANCELLED' && remaining > 0 && (
        <form onSubmit={handlePayment} className="flex items-end gap-2 border-t border-ink/10 pt-4">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-ink/80">Record payment</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={remaining.toFixed(2)}
              className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="rounded-md border border-ink/15 px-2 py-2 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!amount || isActing}
            className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
          >
            Pay
          </button>
        </form>
      )}
    </Modal>
  );
}
