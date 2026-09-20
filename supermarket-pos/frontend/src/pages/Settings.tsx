import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSettings, updateSetting, sendTestPrint } from '../lib/posApi';
import { ApiError } from '../lib/api';

const STORE_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'store.name', label: 'Store name' },
  { key: 'store.address', label: 'Address' },
  { key: 'store.phone', label: 'Phone' },
  { key: 'store.taxNumber', label: 'Tax number' },
  { key: 'store.receiptFooter', label: 'Receipt footer', multiline: true },
  { key: 'pos.largeDiscountPercent', label: 'Standard discount limit (%)' },
];

export default function Settings() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage');

  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(setValues)
      .catch(() => setError('Could not load settings'))
      .finally(() => setIsLoading(false));
  }, []);

  async function save(key: string) {
    setSavingKey(key);
    setError(null);
    try {
      await updateSetting(key, values[key] ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not save "${key}"`);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleTestPrint() {
    setTestPrintStatus('Sending…');
    try {
      await sendTestPrint();
      setTestPrintStatus('Sent to the configured network printer.');
    } catch (err) {
      setTestPrintStatus(err instanceof ApiError ? err.message : 'Could not send the test print');
    }
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-ink/40">Loading…</div>;
  }

  if (!canManage) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          Your role doesn't include permission to change settings.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
      <p className="mt-1 text-ink/60">
        Store details, discount authorization and receipt/printer configuration.
      </p>

      {error && <div className="mt-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <div className="mt-6 max-w-xl space-y-4 rounded-xl border border-ink/10 bg-white p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink/50">Store</h2>
        {STORE_FIELDS.map((f) => (
          <div key={f.key} className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-ink/80">{f.label}</span>
              {f.multiline ? (
                <textarea
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                />
              ) : (
                <input
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                />
              )}
            </label>
            <button
              onClick={() => save(f.key)}
              disabled={savingKey === f.key}
              className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-40"
            >
              {savingKey === f.key ? 'Saving…' : 'Save'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 max-w-xl space-y-5 rounded-xl border border-ink/10 bg-white p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink/50">Receipt printer</h2>

        <div>
          <span className="mb-1 block text-sm font-medium text-ink/80">Paper width</span>
          <div className="flex gap-2">
            {['58', '80'].map((w) => (
              <button
                key={w}
                onClick={() => {
                  setValues((v) => ({ ...v, 'pos.receiptWidth': w }));
                  save('pos.receiptWidth');
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  values['pos.receiptWidth'] === w
                    ? 'border-ledger-600 bg-ledger-50 text-ledger-700'
                    : 'border-ink/15 text-ink/60 hover:bg-paper'
                }`}
              >
                {w}mm
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-ink/80">Printing mode</span>
          <div className="flex flex-wrap gap-2">
            {[
              { v: 'browser', label: 'Browser (system printer)' },
              { v: 'network', label: 'Network (ESC/POS, port 9100)' },
            ].map((m) => (
              <button
                key={m.v}
                onClick={() => {
                  setValues((v) => ({ ...v, 'pos.printerMode': m.v }));
                  save('pos.printerMode');
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  values['pos.printerMode'] === m.v
                    ? 'border-ledger-600 bg-ledger-50 text-ledger-700'
                    : 'border-ink/15 text-ink/60 hover:bg-paper'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {values['pos.printerMode'] === 'network' && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-sm font-medium text-ink/80">Printer IP</span>
                <input
                  value={values['pos.printerHost'] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, 'pos.printerHost': e.target.value }))}
                  placeholder="192.168.1.50"
                  className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-ink/80">Port</span>
                <input
                  value={values['pos.printerPort'] ?? '9100'}
                  onChange={(e) => setValues((v) => ({ ...v, 'pos.printerPort': e.target.value }))}
                  className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={async () => {
                  await save('pos.printerHost');
                  await save('pos.printerPort');
                }}
                className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper"
              >
                Save printer connection
              </button>
              <button
                onClick={handleTestPrint}
                className="rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white hover:bg-ledger-700"
              >
                Send test print
              </button>
            </div>
            {testPrintStatus && <p className="mt-2 text-xs text-ink/50">{testPrintStatus}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
