import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { fetchSale, fetchSettings } from '../../lib/posApi';
import { formatWhatsAppReceipt, normalizeWhatsAppPhone, whatsappReceiptUrl } from '../../lib/whatsappReceipt';

export function WhatsAppReceiptModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([fetchSale(saleId), fetchSettings()]).then(([sale, settings]) => {
      if (!active) return;
      setPhone(sale.customer?.phone || '');
      setMessage(formatWhatsAppReceipt(sale, settings));
    }).catch(() => { if (active) setError('Could not load the receipt. Close this window and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [saleId]);
  let link = '';
  let phoneError = '';
  let normalized = '';
  try {
    normalized = normalizeWhatsAppPhone(phone);
    if (message) link = whatsappReceiptUrl(phone, message);
  } catch (err) { phoneError = (err as Error).message; }
  // Keep large receipts out of URLs that browsers or WhatsApp may truncate.
  const tooLong = link.length > 7000;
  return (
    <Modal title="Send receipt on WhatsApp" onClose={onClose}>
      {loading ? <p>Preparing receipt…</p> : error ? <p role="alert" className="text-brick-600">{error}</p> : <div className="space-y-4">
        <label className="block text-sm font-medium">Customer’s WhatsApp number
          <input type="tel" autoFocus value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="03001234567 or +923001234567" className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2" />
        </label>
        {phone && phoneError && <p role="alert" className="text-sm text-brick-600">{phoneError}</p>}
        {normalized && <p className="text-sm text-ink/60">Recipient: +{normalized}</p>}
        <div>
          <p className="mb-2 text-sm font-medium">Receipt preview</p>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-paper p-3 text-xs">{message}</pre>
        </div>
        <p className="text-sm text-ink/60">Check the number, then open WhatsApp and press Send. Nothing is sent automatically. This number is used only for this receipt.</p>
        {tooLong && <p className="text-sm text-ink/70">This receipt is too long to prefill. Copy it, open the chat, then paste and send it.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-ink/15 px-3 py-2 text-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(message); setCopied(true); }
            catch { setCopied(false); window.alert('Could not copy. Select and copy the receipt preview instead.'); }
          }}>{copied ? 'Copied' : 'Copy receipt'}</button>
          {link ? <a href={tooLong ? `https://wa.me/${normalized}` : link} target="_blank" rel="noopener noreferrer" className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white">Open WhatsApp</a>
            : <button disabled className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white opacity-40">Open WhatsApp</button>}
        </div>
      </div>}
    </Modal>
  );
}
