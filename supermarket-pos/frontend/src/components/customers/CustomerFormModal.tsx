import { FormEvent, ReactNode, useState } from 'react';
import { Modal } from '../ui/Modal';
import { createCustomerFull, updateCustomerFull } from '../../lib/customerApi';
import { ApiError } from '../../lib/api';
import type { Customer } from '../../types/pos';

interface Props {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: { value: Customer['type']; label: string }[] = [
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'CREDIT', label: 'Credit' },
];

export function CustomerFormModal({ customer, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    type: customer?.type ?? 'REGISTERED',
    creditLimit: customer?.creditLimit ?? '0.00',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        type: form.type,
        creditLimit: form.creditLimit || '0.00',
      };
      if (customer) await updateCustomerFull(customer.id, payload);
      else await createCustomerFull(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this customer.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title={customer ? `Edit ${customer.name}` : 'Add customer'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

        <Field label="Name" required>
          <input required value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={`figure ${inputClass}`} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Type">
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setField('type', t.value)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  form.type === t.value ? 'border-ledger-600 bg-ledger-50 text-ledger-700' : 'border-ink/15 text-ink/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        {form.type === 'CREDIT' && (
          <Field label="Credit limit">
            <input
              value={form.creditLimit}
              onChange={(e) => setField('creditLimit', e.target.value)}
              placeholder="0.00"
              className={`figure ${inputClass}`}
            />
          </Field>
        )}

        <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputClass =
  'w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500';

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink/80">
        {label}
        {required && <span className="text-brick-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
