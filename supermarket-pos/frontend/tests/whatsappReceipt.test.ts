import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsAppPhone, formatWhatsAppReceipt, whatsappReceiptUrl } from '../src/lib/whatsappReceipt.ts';

test('phone formatting accepts Pakistani and explicit international numbers', () => {
  for (const phone of ['03001234567', '3001234567', '+92 300-1234567', '00923001234567', '923001234567']) {
    assert.equal(normalizeWhatsAppPhone(phone), '923001234567');
  }
  assert.equal(normalizeWhatsAppPhone('+44 7700 900123'), '447700900123');
  for (const phone of ['', '123', '+9203001234567', '0300123456', 'abc03001234567', '+92+3001234567']) {
    assert.throws(() => normalizeWhatsAppPhone(phone));
  }
});

test('receipt preserves recorded totals and safely encodes customer text', () => {
  const sale = {
    id: 'sale-1', invoiceNumber: 'INV-001', createdAt: '2026-09-21T10:00:00Z',
    subtotal: '100', discountAmount: '10', taxAmount: '5', total: '95', status: 'COMPLETED',
    customer: null, cashier: { id: 'user-1', name: 'Cashier' },
    items: [{ id: 'i1', productId: 'p1', quantity: '2', unitPrice: '50', discount: '0', tax: '0', subtotal: '100', product: { name: 'Tea & milk #1', sku: 'TEA' } }],
    payments: [{ method: 'CREDIT' as const, amount: '95' }],
  };
  const message = formatWhatsAppReceipt(sale, { 'store.name': 'My Store', 'store.receiptFooter': 'شکریہ' });
  assert.match(message, /^My Store/);
  assert.match(message, /TOTAL: 95.00/);
  assert.match(message, /CREDIT: 95.00/);
  const url = new URL(whatsappReceiptUrl('03001234567', message));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/923001234567');
  assert.equal(url.searchParams.get('text'), message);
  assert.equal(url.hash, '');
  assert.match(formatWhatsAppReceipt({ ...sale, status: 'PARTIALLY_RETURNED' }, {}), /refunds are separate/);
});
