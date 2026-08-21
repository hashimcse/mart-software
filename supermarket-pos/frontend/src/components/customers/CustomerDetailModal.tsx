import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { fetchCustomer, recordCustomerPaymentFull, adjustLoyaltyPoints } from '../../lib/customerApi';
import type { CustomerDetail } from '../../lib/customerApi';
import { ApiError } from '../../lib/api';
import type { PaymentMethod } from '../../types/pos';

interface Props {
  customerId: string;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT'];

export function CustomerDetailModal({ customerId, onClose }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [pointsDelta, setPointsDelta] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function load() {
    fetchCustomer(customerId).then(setCustomer).catch(() => setError('Could not load this customer'));
  }

  useEffect(load, [customerId]);

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    if (!paymentAmount) return;
    setError(null);
    setIsSaving(true);
    try {
      await recordCustomerPaymentFull(customerId, { amount: paymentAmount, method: paymentMethod });
      setPaymentAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this payment');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePointsAdjust(e: FormEvent) {
    e.preventDefault();
    const delta = Number(pointsDelta);
    if (!delta || !pointsReason) return;
    setError(null);
    setIsSaving(true);
    try {
      await adjustLoyaltyPoints(customerId, { pointsChange: delta, reason: pointsReason });
      setPointsDelta('');
      setPointsReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not adjust loyalty points');
    } finally {
      setIsSaving(false);
    }
  }

  if (!customer) {
    return (
      <Modal title="Customer" onClose={onClose}>
        <p className="text-sm text-ink/40">Loading…</p>
      </Modal>
    );
  }

  return (
    <Modal title={customer.name} onClose={onClose} widthClass="max-w-xl">
      {error && <div className="mb-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <MiniStat label="Loyalty points" value={String(customer.loyaltyPoints)} />
        {customer.balance && (
          <>
            <MiniStat label="Credit owed" value={Number(customer.balance.totalCredit).toFixed(2)} />
            <MiniStat
              label="Outstanding"
              value={Number(customer.balance.outstandingBalance).toFixed(2)}
              tone={Number(customer.balance.outstandingBalance) > 0 ? 'brick' : 'ledger'}
            />
          </>
        )}
      </div>

      {customer.type === 'CREDIT' && Number(customer.balance?.outstandingBalance ?? 0) > 0 && (
        <form onSubmit={handlePayment} className="mb-5 flex items-end gap-2 border-b border-ink/10 pb-5">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-ink/80">Record credit payment</span>
            <input
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
            />
          </label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="rounded-md border border-ink/15 px-2 py-2 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!paymentAmount || isSaving}
            className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
          >
            Pay
          </button>
        </form>
      )}

      <form onSubmit={handlePointsAdjust} className="mb-5 flex items-end gap-2 border-b border-ink/10 pb-5">
        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">Adjust points</span>
          <input
            value={pointsDelta}
            onChange={(e) => setPointsDelta(e.target.value)}
            placeholder="+10 or -10"
            className="figure w-28 rounded-md border border-ink/15 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-ink/80">Reason</span>
          <input
            value={pointsReason}
            onChange={(e) => setPointsReason(e.target.value)}
            placeholder="e.g. redeemed for discount, goodwill bonus"
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={!pointsDelta || !pointsReason || isSaving}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-50"
        >
          Apply
        </button>
      </form>

      <h3 className="mb-2 text-sm font-semibold text-ink/60">Purchase history</h3>
      <div className="max-h-40 overflow-y-auto">
        {customer.recentSales.length === 0 ? (
          <p className="text-sm text-ink/40">No purchases yet.</p>
        ) : (
          <div className="divide-y divide-ink/5">
            {customer.recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="figure text-ink">{s.invoiceNumber}</span>
                <span className="text-ink/40">{new Date(s.createdAt).toLocaleDateString()}</span>
                <span className="figure font-medium text-ink">{Number(s.total).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'brick' | 'ledger' }) {
  const color = tone === 'brick' ? 'text-brick-600' : tone === 'ledger' ? 'text-ledger-700' : 'text-ink';
  return (
    <div className="rounded-lg border border-ink/10 p-3">
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`figure mt-1 text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
