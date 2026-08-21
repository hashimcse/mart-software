import type { CartLine } from '../types/pos';

export interface LineTotals {
  taxable: number;
  tax: number;
  subtotal: number;
}

// Mirrors the backend's decimal-safe calculation (services/sale.service.ts)
// in plain floating point, for a responsive on-screen preview only. The
// submitted sale's authoritative totals are always computed server-side
// with Prisma.Decimal and returned in the response — this never has the
// final word.
export function computeLineTotals(line: CartLine): LineTotals {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Number(line.discount) || 0;
  const taxable = qty * price - discount;

  let tax = 0;
  let subtotal = taxable;
  if (line.taxRate) {
    const rate = Number(line.taxRate) / 100;
    if (line.taxInclusive) {
      tax = taxable - taxable / (1 + rate);
      subtotal = taxable - tax;
    } else {
      tax = taxable * rate;
      subtotal = taxable;
    }
  }
  return { taxable, tax, subtotal };
}

export function computeCartTotals(lines: CartLine[], cartDiscount: string) {
  let subtotal = 0;
  let tax = 0;
  for (const line of lines) {
    const t = computeLineTotals(line);
    subtotal += t.subtotal;
    tax += t.tax;
  }
  const discount = Number(cartDiscount) || 0;
  const total = Math.max(0, subtotal + tax - discount);
  return { subtotal, tax, discount, total };
}
