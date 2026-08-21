import { EscPosBuilder, padLine } from '../utils/escpos';
import { getSettings } from './settings.service';
import { getSaleById } from './sale.service';

const COLUMNS: Record<string, number> = { '58': 32, '80': 48 };

function columnsFor(settings: Record<string, unknown>): number {
  return COLUMNS[String(settings['pos.receiptWidth']) === '58' ? '58' : '80'];
}

export async function buildReceiptBytes(saleId: string): Promise<Buffer> {
  const [sale, settings] = await Promise.all([getSaleById(saleId), getSettings()]);
  const width = columnsFor(settings);

  const b = new EscPosBuilder().init().align('center').bold(true).line(String(settings['store.name']));
  b.bold(false);
  if (settings['store.address']) b.line(String(settings['store.address']));
  if (settings['store.phone']) b.line(String(settings['store.phone']));
  b.align('left').divider(width);
  b.line(`Invoice: ${sale.invoiceNumber}`);
  b.line(`Date: ${new Date(sale.createdAt).toLocaleString()}`);
  b.line(`Cashier: ${sale.cashier.name}`);
  if (sale.customer) b.line(`Customer: ${sale.customer.name}`);
  b.divider(width);

  for (const item of sale.items) {
    b.line(item.product.name);
    const qtyPrice = `${item.quantity} x ${Number(item.unitPrice).toFixed(2)}`;
    b.line(padLine(qtyPrice, Number(item.subtotal).toFixed(2), width));
  }

  b.divider(width);
  b.line(padLine('Subtotal', Number(sale.subtotal).toFixed(2), width));
  if (Number(sale.discountAmount) > 0) {
    b.line(padLine('Discount', `-${Number(sale.discountAmount).toFixed(2)}`, width));
  }
  b.line(padLine('Tax', Number(sale.taxAmount).toFixed(2), width));
  b.bold(true);
  b.line(padLine('TOTAL', Number(sale.total).toFixed(2), width));
  b.bold(false);

  for (const payment of sale.payments) {
    b.line(padLine(payment.method, Number(payment.amount).toFixed(2), width));
  }

  b.divider(width).align('center');
  const footer = String(settings['store.receiptFooter'] ?? '');
  for (const line of footer.split('\n').filter(Boolean)) b.line(line);

  b.feed(3).cut();
  return b.build();
}

export async function buildTestReceiptBytes(): Promise<Buffer> {
  const settings = await getSettings();
  const width = columnsFor(settings);
  const widthLabel = width === 32 ? '58mm' : '80mm';

  const b = new EscPosBuilder()
    .init()
    .align('center')
    .bold(true)
    .line(String(settings['store.name']))
    .bold(false)
    .line('TEST PRINT')
    .divider(width)
    .align('left')
    .line(`Printed: ${new Date().toLocaleString()}`)
    .line(`Paper width: ${widthLabel}`)
    .divider(width)
    .align('center')
    .line('If you can read this,')
    .line('the printer is configured correctly.')
    .feed(3)
    .cut();

  return b.build();
}
