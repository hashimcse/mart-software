import type { SaleResult, Settings } from '../types/pos';

export function normalizeWhatsAppPhone(input: string): string {
  const value = input.trim();
  if (!/^[+\d\s().-]+$/.test(value)) throw new Error('Enter a valid WhatsApp phone number.');
  let digits = value.replace(/[\s().-]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (/^03\d{9}$/.test(digits)) digits = '92' + digits.slice(1);
  else if (/^3\d{9}$/.test(digits)) digits = '92' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits) || (digits.startsWith('92') && !/^923\d{9}$/.test(digits))) {
    throw new Error('Use a Pakistani mobile number such as 03001234567, or an international number with its country code.');
  }
  return digits;
}

export function formatWhatsAppReceipt(sale: SaleResult, settings: Settings): string {
  const money = (value: string) => Number(value).toFixed(2);
  const lines = [settings['store.name']?.trim() || 'Supermarket POS'];
  if (settings['store.address']) lines.push(settings['store.address']);
  if (settings['store.phone']) lines.push(`Store phone: ${settings['store.phone']}`);
  lines.push('', `Receipt: ${sale.invoiceNumber}`, `Date: ${new Date(sale.createdAt).toLocaleString()}`);
  if (sale.customer) lines.push(`Customer: ${sale.customer.name}`);
  if (sale.status !== 'COMPLETED') lines.push(`Status: ${sale.status.replace(/_/g, ' ')}`, 'Original sale amounts below; refunds are separate.');
  lines.push('');
  for (const item of sale.items) {
    lines.push(`${item.product.name} — ${item.quantity} × ${money(item.unitPrice)} = ${money(item.subtotal)}`);
  }
  lines.push('', `Subtotal: ${money(sale.subtotal)}`, `Discount: ${money(sale.discountAmount)}`, `Tax: ${money(sale.taxAmount)}`, `TOTAL: ${money(sale.total)}`);
  for (const payment of sale.payments) lines.push(`${payment.method.replace(/_/g, ' ')}: ${money(payment.amount)}`);
  if (settings['store.receiptFooter']) lines.push('', settings['store.receiptFooter']);
  return lines.join('\n');
}

export function whatsappReceiptUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(message)}`;
}
