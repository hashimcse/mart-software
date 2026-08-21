import { fetchSale, fetchSettings } from './posApi';

const COLUMN_WIDTHS: Record<string, number> = { '58': 32, '80': 48 };

function pad(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right;
}

function center(text: string, width: number): string {
  const p = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(p) + text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Prints via the browser's own print dialog — the path that works for any
// thermal printer installed as a normal system printer (very common: most
// receipt printers ship a Windows/Mac driver, or work with the OS's
// generic/text-only driver). Opens an isolated window so the print
// stylesheet doesn't have to fight the rest of the app's layout.
export async function printReceiptInBrowser(saleId: string): Promise<void> {
  const [sale, settings] = await Promise.all([fetchSale(saleId), fetchSettings()]);
  const widthKey = settings['pos.receiptWidth'] === '58' ? '58' : '80';
  const cols = COLUMN_WIDTHS[widthKey];
  const mmWidth = widthKey === '58' ? '58mm' : '80mm';

  const lines: string[] = [];
  lines.push(center(settings['store.name'] ?? '', cols));
  if (settings['store.address']) lines.push(center(settings['store.address'], cols));
  if (settings['store.phone']) lines.push(center(settings['store.phone'], cols));
  lines.push('-'.repeat(cols));
  lines.push(`Invoice: ${sale.invoiceNumber}`);
  lines.push(`Date: ${new Date(sale.createdAt).toLocaleString()}`);
  lines.push(`Cashier: ${sale.cashier.name}`);
  if (sale.customer) lines.push(`Customer: ${sale.customer.name}`);
  lines.push('-'.repeat(cols));

  for (const item of sale.items) {
    lines.push(item.product.name);
    lines.push(pad(`${item.quantity} x ${Number(item.unitPrice).toFixed(2)}`, Number(item.subtotal).toFixed(2), cols));
  }

  lines.push('-'.repeat(cols));
  lines.push(pad('Subtotal', Number(sale.subtotal).toFixed(2), cols));
  if (Number(sale.discountAmount) > 0) {
    lines.push(pad('Discount', `-${Number(sale.discountAmount).toFixed(2)}`, cols));
  }
  lines.push(pad('Tax', Number(sale.taxAmount).toFixed(2), cols));
  lines.push(pad('TOTAL', Number(sale.total).toFixed(2), cols));

  for (const p of sale.payments) {
    lines.push(pad(p.method, Number(p.amount).toFixed(2), cols));
  }

  lines.push('');
  const footer = settings['store.receiptFooter'] ?? '';
  for (const l of footer.split('\n').filter(Boolean)) lines.push(center(l, cols));

  const win = window.open('', '_blank', 'width=420,height=640');
  if (!win) {
    throw new Error('Your browser blocked the print window — allow pop-ups for this site and try again.');
  }

  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <title>${escapeHtml(sale.invoiceNumber)}</title>
    <style>
      @page { size: ${mmWidth} auto; margin: 0; }
      body {
        width: ${mmWidth};
        margin: 0;
        padding: 4mm;
        font-family: 'Courier New', Courier, monospace;
        font-size: 11px;
        white-space: pre;
      }
    </style>
  </head>
  <body>${lines.map(escapeHtml).join('\n')}</body>
</html>`);
  doc.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
