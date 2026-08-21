import { assetUrl } from '../../lib/api';
import { computeLineTotals } from '../../lib/cartMath';
import type { CartLine } from '../../types/pos';

interface Props {
  lines: CartLine[];
  selectedProductId: string | null;
  onSelect: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: string) => void;
  onDiscountChange: (productId: string, discount: string) => void;
  onRemove: (productId: string) => void;
}

export function CartTable({ lines, selectedProductId, onSelect, onQuantityChange, onDiscountChange, onRemove }: Props) {
  if (lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink/30">
        Scan a barcode or search above to start this sale.
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 border-b border-ink/10 bg-white text-xs uppercase tracking-wide text-ink/40">
        <tr>
          <th className="px-4 py-2 font-medium">Item</th>
          <th className="px-4 py-2 text-right font-medium">Qty</th>
          <th className="figure px-4 py-2 text-right font-medium">Price</th>
          <th className="figure px-4 py-2 text-right font-medium">Discount</th>
          <th className="figure px-4 py-2 text-right font-medium">Line total</th>
          <th className="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/5">
        {lines.map((line) => {
          const totals = computeLineTotals(line);
          const overStock = Number(line.quantity) > Number(line.availableStock);
          const step = line.isWeighted ? 0.1 : 1;
          const decimals = line.isWeighted ? 3 : 0;

          return (
            <tr
              key={line.productId}
              onClick={() => onSelect(line.productId)}
              className={`cursor-pointer ${selectedProductId === line.productId ? 'bg-ledger-50' : 'hover:bg-paper/60'}`}
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-paper text-[10px] text-ink/30">
                    {line.imageUrl ? (
                      <img src={assetUrl(line.imageUrl)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{line.name}</p>
                    <p className="figure text-xs text-ink/40">{line.sku}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="inline-flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuantityChange(line.productId, Math.max(0, Number(line.quantity) - step).toFixed(decimals));
                    }}
                    className="figure h-6 w-6 rounded border border-ink/15 text-ink/60 hover:bg-paper"
                  >
                    −
                  </button>
                  <input
                    value={line.quantity}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onQuantityChange(line.productId, e.target.value)}
                    className={`figure w-14 rounded border py-1 text-center text-sm ${overStock ? 'border-brick-500 text-brick-600' : 'border-ink/15'}`}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuantityChange(line.productId, (Number(line.quantity) + step).toFixed(decimals));
                    }}
                    className="figure h-6 w-6 rounded border border-ink/15 text-ink/60 hover:bg-paper"
                  >
                    +
                  </button>
                </div>
                {overStock && <p className="mt-0.5 text-[11px] text-brick-500">only {line.availableStock} in stock</p>}
              </td>
              <td className="figure px-4 py-2.5 text-right text-ink/70">{Number(line.unitPrice).toFixed(2)}</td>
              <td className="px-4 py-2.5 text-right">
                <input
                  value={line.discount}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onDiscountChange(line.productId, e.target.value)}
                  placeholder="0.00"
                  className="figure w-16 rounded border border-ink/15 py-1 text-right text-sm"
                />
              </td>
              <td className="figure px-4 py-2.5 text-right font-medium text-ink">{totals.taxable.toFixed(2)}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(line.productId);
                  }}
                  className="text-ink/30 hover:text-brick-600"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
