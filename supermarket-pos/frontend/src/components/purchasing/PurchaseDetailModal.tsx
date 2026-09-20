import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { fetchPurchase, receivePurchase, invoicePurchase, cancelPurchase, recordSupplierPayment } from '../../lib/purchasingApi';
import { fetchPurchaseReturnableLines, createPurchaseReturn } from '../../lib/returnApi';
import { ApiError } from '../../lib/api';
import type { PaymentMethod } from '../../types/pos';
import type { Purchase } from '../../types/purchasing';
import type { PurchaseReturnableLine } from '../../types/returns';

interface Props {
  purchaseId: string;
  onClose: () => void;
  onChanged: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT'];
const RECEIVABLE_STATUSES = ['RECEIVED', 'INVOICED', 'PAID'];

export function PurchaseDetailModal({ purchaseId, onClose, onChanged }: Props) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnLines, setReturnLines] = useState<PurchaseReturnableLine[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState('');

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

  async function openReturnForm() {
    setShowReturnForm(true);
    setError(null);
    try {
      const data = await fetchPurchaseReturnableLines(purchaseId);
      setReturnLines(data.lines);
      const initial: Record<string, string> = {};
      for (const l of data.lines) initial[l.purchaseItemId] = '0';
      setReturnQuantities(initial);
    } catch {
      setError('Could not load returnable items');
    }
  }

  async function handlePurchaseReturn(e: FormEvent) {
    e.preventDefault();
    const items = Object.entries(returnQuantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([purchaseItemId, quantity]) => ({ purchaseItemId, quantity }));
    if (items.length === 0) {
      setError('Enter a quantity for at least one item.');
      return;
    }
    setError(null);
    setIsActing(true);
    try {
      await createPurchaseReturn(purchaseId, { items, reason: returnReason || undefined });
      setShowReturnForm(false);
      setReturnReason('');
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not process this return');
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
        {RECEIVABLE_STATUSES.includes(purchase.status) && !showReturnForm && (
          <button
            onClick={openReturnForm}
            disabled={isActing}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-50"
          >
            Return items to supplier
          </button>
        )}
        {(purchase.status === 'RECEIVED' || purchase.status === 'INVOICED') && remaining === 0 && (
          <span className="rounded-md bg-ledger-50 px-3 py-2 text-sm font-medium text-ledger-700">Fully paid</span>
        )}
      </div>

      {showReturnForm && (
        <form onSubmit={handlePurchaseReturn} className="mb-4 space-y-3 border-t border-ink/10 pt-4">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink/40">
              <tr>
                <th className="py-1 font-medium">Item</th>
                <th className="py-1 text-right font-medium">Returnable</th>
                <th className="py-1 text-right font-medium">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {returnLines.map((l) => (
                <tr key={l.purchaseItemId}>
                  <td className="py-1.5 text-ink">{l.productName}</td>
                  <td className="figure py-1.5 text-right text-ink/60">{l.returnable}</td>
                  <td className="py-1.5 text-right">
                    <input
                      value={returnQuantities[l.purchaseItemId] ?? '0'}
                      onChange={(e) => setReturnQuantities((q) => ({ ...q, [l.purchaseItemId]: e.target.value }))}
                      disabled={Number(l.returnable) <= 0}
                      className="figure w-16 rounded border border-ink/15 py-1 text-right text-sm disabled:bg-paper disabled:text-ink/30"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <input
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Reason (e.g. damaged on arrival, wrong item)"
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReturnForm(false)}
              className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isActing}
              className="rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
            >
              Confirm return
            </button>
          </div>
        </form>
      )}

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
