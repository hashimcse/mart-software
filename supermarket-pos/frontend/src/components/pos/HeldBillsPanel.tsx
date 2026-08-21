import type { HeldBill } from '../../types/pos';

interface Props {
  bills: HeldBill[];
  onResume: (bill: HeldBill) => void;
  onDiscard: (bill: HeldBill) => void;
}

export function HeldBillsPanel({ bills, onResume, onDiscard }: Props) {
  if (bills.length === 0) {
    return <p className="p-4 text-sm text-ink/40">No held bills.</p>;
  }
  return (
    <div className="divide-y divide-ink/5">
      {bills.map((bill) => (
        <div key={bill.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">
              {bill.customer?.name ?? 'Walk-in'} · {bill.cartData.cart.length} item
              {bill.cartData.cart.length === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-ink/40">
              Held by {bill.cashier.name} at {new Date(bill.createdAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => onResume(bill)} className="text-sm font-medium text-ledger-600 hover:text-ledger-700">
              Resume
            </button>
            <button onClick={() => onDiscard(bill)} className="text-sm font-medium text-ink/40 hover:text-brick-600">
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
