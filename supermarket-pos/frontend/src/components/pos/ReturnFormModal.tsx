import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { fetchReturnableLines, createReturn } from '../../lib/returnApi';
import { ApiError } from '../../lib/api';
import type { ReturnableSale } from '../../types/returns';

interface Props {
  saleId: string;
  onClose: () => void;
  onCompleted: (refundAmount: string) => void;
}

interface LineState {
  quantity: string;
  restock: boolean;
}

const REFUND_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT'] as const;

export function ReturnFormModal({ saleId, onClose, onCompleted }: Props) {
  const [data, setData] = useState<ReturnableSale | null>(null);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<(typeof REFUND_METHODS)[number]>('CASH');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchReturnableLines(saleId)
      .then((d) => {
        setData(d);
        const initial: Record<string, LineState> = {};
        for (const l of d.lines) initial[l.saleItemId] = { quantity: '0', restock: true };
        setLines(initial);
      })
      .catch(() => setError('Could not load this sale'));
  }, [saleId]);

  function updateLine(saleItemId: string, patch: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [saleItemId]: { ...prev[saleItemId], ...patch } }));
  }

  // Preview only — priced at unit price times quantity, not the backend's
  // proportional subtotal+tax formula (which needs the sale's discount/tax
  // breakdown this screen doesn't have). The server's response is what
  // actually gets shown as the confirmed refund.
  const estimatedRefund = useMemo(() => {
    if (!data) return 0;
    return data.lines.reduce((sum, l) => {
      const qty = Number(lines[l.saleItemId]?.quantity ?? 0);
      return qty > 0 ? sum + Number(l.unitPrice) * qty : sum;
    }, 0);
  }, [data, lines]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const items = Object.entries(lines)
      .filter(([, l]) => Number(l.quantity) > 0)
      .map(([saleItemId, l]) => ({ saleItemId, quantity: l.quantity, restock: l.restock }));
    if (items.length === 0) {
      setError('Enter a quantity for at least one item.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const result = await createReturn({ saleId, items, reason: reason || undefined, refundMethod });
      onCompleted(result.totalRefund);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not process this return');
    } finally {
      setIsSaving(false);
    }
  }

  if (!data) {
    return (
      <Modal title="Return items" onClose={onClose}>
        {error ? <p className="text-sm text-brick-600">{error}</p> : <p className="text-sm text-ink/40">Loading…</p>}
      </Modal>
    );
  }

  return (
    <Modal title={`Return items — ${data.invoiceNumber}`} onClose={onClose} widthClass="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink/40">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Returnable</th>
              <th className="py-2 text-right font-medium">Return qty</th>
              <th className="py-2 text-center font-medium">Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {data.lines.map((l) => {
              const maxed = Number(l.returnable) <= 0;
              return (
                <tr key={l.saleItemId}>
                  <td className="py-2">
                    <p className="font-medium text-ink">{l.productName}</p>
                    <p className="figure text-xs text-ink/40">
                      {l.sku}
                      {Number(l.alreadyReturned) > 0 && ` · ${l.alreadyReturned} already returned`}
                    </p>
                  </td>
                  <td className="figure py-2 text-right text-ink/60">{l.returnable}</td>
                  <td className="py-2 text-right">
                    <input
                      value={lines[l.saleItemId]?.quantity ?? '0'}
                      onChange={(e) => updateLine(l.saleItemId, { quantity: e.target.value })}
                      disabled={maxed}
                      className="figure w-20 rounded border border-ink/15 py-1 text-right text-sm disabled:bg-paper disabled:text-ink/30"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={maxed}
                      checked={lines[l.saleItemId]?.restock ?? true}
                      onChange={(e) => updateLine(l.saleItemId, { restock: e.target.checked })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. wrong size, changed mind, defective"
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink/80">Refund method</span>
          <select
            value={refundMethod}
            onChange={(e) => setRefundMethod(e.target.value as (typeof REFUND_METHODS)[number])}
            className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
          >
            {REFUND_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {refundMethod === 'CASH' && (
            <p className="mt-1 text-xs text-ink/40">Recorded against the terminal's open cash register, if one is open.</p>
          )}
        </label>

        <div className="flex items-center justify-between border-t border-ink/10 pt-4">
          <p className="text-sm text-ink/50">
            Estimated refund <span className="figure ml-2 font-semibold text-ink">{estimatedRefund.toFixed(2)}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-60"
            >
              {isSaving ? 'Processing…' : 'Process return'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
