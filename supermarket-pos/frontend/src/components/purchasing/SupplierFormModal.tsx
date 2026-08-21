import { FormEvent, ReactNode, useState } from 'react';
import { Modal } from '../ui/Modal';
import { createSupplier, updateSupplier } from '../../lib/purchasingApi';
import { ApiError } from '../../lib/api';
import type { Supplier } from '../../types/purchasing';

interface Props {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SupplierFormModal({ supplier, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    company: supplier?.company ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    taxId: supplier?.taxId ?? '',
    openingBalance: supplier?.openingBalance ?? '0.00',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        company: form.company || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        taxId: form.taxId || undefined,
        openingBalance: form.openingBalance || '0.00',
      };
      if (supplier) await updateSupplier(supplier.id, payload);
      else await createSupplier(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this supplier.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title={supplier ? `Edit ${supplier.name}` : 'Add supplier'} onClose={onClose} widthClass="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required>
            <input required value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Company">
            <input value={form.company} onChange={(e) => setField('company', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={`figure ${inputClass}`} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Tax ID">
            <input value={form.taxId} onChange={(e) => setField('taxId', e.target.value)} className={`figure ${inputClass}`} />
          </Field>
          <Field label="Opening balance">
            <input
              value={form.openingBalance}
              onChange={(e) => setField('openingBalance', e.target.value)}
              placeholder="0.00"
              className={`figure ${inputClass}`}
            />
          </Field>
        </div>

        <Field label="Address">
          <textarea value={form.address} onChange={(e) => setField('address', e.target.value)} rows={2} className={inputClass} />
        </Field>

        <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save supplier'}
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
