import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { printReceiptInBrowser } from '../../lib/receiptPrint';
import { printSaleOverNetwork } from '../../lib/posApi';
import { ApiError } from '../../lib/api';
import type { SaleResult } from '../../types/pos';

interface Props {
  sale: SaleResult;
  changeDue: string;
  loyaltyPointsEarned: number;
  printerMode: string;
  onClose: () => void;
}

export function SaleCompleteModal({ sale, changeDue, loyaltyPointsEarned, printerMode, onClose }: Props) {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePrint() {
    setIsPrinting(true);
    setPrintStatus(null);
    try {
      if (printerMode === 'network') {
        await printSaleOverNetwork(sale.id);
        setPrintStatus('Sent to the network printer.');
      } else {
        await printReceiptInBrowser(sale.id);
        setPrintStatus(null);
      }
    } catch (err) {
      setPrintStatus(err instanceof ApiError || err instanceof Error ? err.message : 'Could not print this receipt.');
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <Modal title={`Sale complete — ${sale.invoiceNumber}`} onClose={onClose} widthClass="max-w-sm">
      <div className="figure space-y-2 text-sm">
        {sale.items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span className="font-sans text-ink/70">
              {item.product.name} × {item.quantity}
            </span>
            <span>{Number(item.subtotal).toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-ink/15 pt-2">
          <div className="flex justify-between text-ink/60">
            <span className="font-sans">Subtotal</span>
            <span>{Number(sale.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-ink/60">
            <span className="font-sans">Discount</span>
            <span>-{Number(sale.discountAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-ink/60">
            <span className="font-sans">Tax</span>
            <span>{Number(sale.taxAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-ink">
            <span className="font-sans">Total</span>
            <span>{Number(sale.total).toFixed(2)}</span>
          </div>
        </div>
        <div className="border-t border-dashed border-ink/15 pt-2">
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-ink/60">
              <span className="font-sans">{p.method}</span>
              <span>{Number(p.amount).toFixed(2)}</span>
            </div>
          ))}
          {Number(changeDue) > 0 && (
            <div className="flex justify-between font-semibold text-ledger-700">
              <span className="font-sans">Change</span>
              <span>{Number(changeDue).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {printStatus && <p className="mt-3 rounded-md bg-paper px-3 py-2 text-xs text-ink/60">{printStatus}</p>}
      {loyaltyPointsEarned > 0 && (
        <p className="mt-3 rounded-md bg-brass-50 px-3 py-2 text-sm font-medium text-brass-600">
          +{loyaltyPointsEarned} loyalty points earned
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="flex-1 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-50"
        >
          {isPrinting ? 'Printing…' : 'Print receipt'}
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700"
        >
          New sale
        </button>
      </div>
    </Modal>
  );
}
