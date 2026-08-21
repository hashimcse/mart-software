import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { fetchSupplier, recordSupplierPayment } from '../../lib/purchasingApi';
import { ApiError } from '../../lib/api';
import type { PaymentMethod } from '../../types/pos';
import type { Supplier } from '../../types/purchasing';

interface Props {
  supplierId: string;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT'];

export function SupplierDetailModal({ supplierId, onClose }: Props) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function load() {
    fetchSupplier(supplierId).then(setSupplier).catch(() => setError('Could not load this supplier'));
  }

  useEffect(load, [supplierId]);

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setError(null);
    setIsSaving(true);
    try {
      await recordSupplierPayment(supplierId, { amount, method });
      setAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this payment');
    } finally {
      setIsSaving(false);
    }
  }

  if (!supplier) {
    return (
      <Modal title="Supplier" onClose={onClose}>
        <p className="text-sm text-ink/40">Loading…</p>
      </Modal>
    );
  }

  const balance = supplier.balance;

  return (
    <Modal title={supplier.name} onClose={onClose} widthClass="max-w-lg">
      {error && <div className="mb-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      {balance && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <MiniStat label="Purchased" value={balance.totalPurchases} />
          <MiniStat label="Paid" value={balance.totalPaid} />
          <MiniStat
            label="Outstanding"
            value={balance.outstandingBalance}
            tone={Number(balance.outstandingBalance) > 0 ? 'brick' : 'ledger'}
          />
        </div>
      )}

      <form onSubmit={handleRecordPayment} className="mb-5 flex items-end gap-2 border-b border-ink/10 pb-5">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-ink/80">Record payment</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
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
          disabled={!amount || isSaving}
          className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Pay'}
        </button>
      </form>

      <h3 className="mb-2 text-sm font-semibold text-ink/60">Recent payments</h3>
      <div className="max-h-48 overflow-y-auto">
        {!supplier.payments || supplier.payments.length === 0 ? (
          <p className="text-sm text-ink/40">No payments recorded yet.</p>
        ) : (
          <div className="divide-y divide-ink/5">
            {supplier.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink/60">{p.method}</span>
                <span className="text-ink/40">{new Date(p.createdAt).toLocaleDateString()}</span>
                <span className="figure font-medium text-ink">{Number(p.amount).toFixed(2)}</span>
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
      <p className={`figure mt-1 text-sm font-semibold ${color}`}>{Number(value).toFixed(2)}</p>
    </div>
  );
}
