import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { createProduct, updateProduct, uploadProductImage, fetchUnits } from '../../lib/catalogApi';
import { ApiError } from '../../lib/api';
import type { Brand, Category, Product, Unit } from '../../types/catalog';

interface Props {
  product: Product | null;
  categories: Category[];
  brands: Brand[];
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  categoryId: '',
  brandId: '',
  unitId: '',
  purchasePrice: '',
  sellingPrice: '',
  wholesalePrice: '',
  currentStock: '0',
  minStock: '0',
  isWeighted: false,
  batchNumber: '',
  expiryDate: '',
  description: '',
  location: '',
};

type FormState = typeof emptyForm;

export function ProductFormModal({ product, categories, brands, onClose, onSaved }: Props) {
  const { hasPermission } = useAuth();
  const canEditPrice = hasPermission('products.price.edit');
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState<FormState>(() =>
    product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? '',
          categoryId: product.categoryId ?? '',
          brandId: product.brandId ?? '',
          unitId: product.unitId,
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          wholesalePrice: product.wholesalePrice ?? '',
          currentStock: product.currentStock,
          minStock: product.minStock,
          isWeighted: product.isWeighted,
          batchNumber: product.batchNumber ?? '',
          expiryDate: product.expiryDate ? product.expiryDate.slice(0, 10) : '',
          description: product.description ?? '',
          location: product.location ?? '',
        }
      : emptyForm,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUnits().then(setUnits).catch(() => {});
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode || undefined,
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        unitId: form.unitId,
        currentStock: form.currentStock || '0',
        minStock: form.minStock || '0',
        isWeighted: form.isWeighted,
        batchNumber: form.batchNumber || undefined,
        expiryDate: form.expiryDate || null,
        description: form.description || undefined,
        location: form.location || undefined,
      };
      if (canEditPrice) {
        payload.purchasePrice = form.purchasePrice;
        payload.sellingPrice = form.sellingPrice;
        payload.wholesalePrice = form.wholesalePrice || undefined;
      }

      const saved = product ? await updateProduct(product.id, payload) : await createProduct(payload);

      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await uploadProductImage(saved.id, fd);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this product.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title={product ? `Edit ${product.name}` : 'Add product'} onClose={onClose} widthClass="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required>
            <input required value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass} />
          </Field>
          <Field label="SKU" required>
            <input required value={form.sku} onChange={(e) => setField('sku', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Barcode">
            <input
              value={form.barcode}
              onChange={(e) => setField('barcode', e.target.value)}
              className={`figure ${inputClass}`}
            />
          </Field>
          <Field label="Unit" required>
            <select required value={form.unitId} onChange={(e) => setField('unitId', e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.abbreviation})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select value={form.categoryId} onChange={(e) => setField('categoryId', e.target.value)} className={inputClass}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <select value={form.brandId} onChange={(e) => setField('brandId', e.target.value)} className={inputClass}>
              <option value="">None</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Purchase price">
            <input
              required={canEditPrice}
              disabled={!canEditPrice}
              value={form.purchasePrice}
              onChange={(e) => setField('purchasePrice', e.target.value)}
              placeholder="0.00"
              className={`figure ${inputClass} disabled:bg-paper disabled:text-ink/40`}
            />
          </Field>
          <Field label="Selling price">
            <input
              required={canEditPrice}
              disabled={!canEditPrice}
              value={form.sellingPrice}
              onChange={(e) => setField('sellingPrice', e.target.value)}
              placeholder="0.00"
              className={`figure ${inputClass} disabled:bg-paper disabled:text-ink/40`}
            />
          </Field>
          <Field label="Wholesale price">
            <input
              disabled={!canEditPrice}
              value={form.wholesalePrice}
              onChange={(e) => setField('wholesalePrice', e.target.value)}
              placeholder="0.00"
              className={`figure ${inputClass} disabled:bg-paper disabled:text-ink/40`}
            />
          </Field>
          <Field label="Current stock">
            <input value={form.currentStock} onChange={(e) => setField('currentStock', e.target.value)} className={`figure ${inputClass}`} />
          </Field>
          <Field label="Minimum stock">
            <input value={form.minStock} onChange={(e) => setField('minStock', e.target.value)} className={`figure ${inputClass}`} />
          </Field>
          <Field label="Batch number">
            <input value={form.batchNumber} onChange={(e) => setField('batchNumber', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Expiry date">
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setField('expiryDate', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Sold by weight/volume">
            <label className="flex items-center gap-2 pt-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={form.isWeighted}
                onChange={(e) => setField('isWeighted', e.target.checked)}
              />
              Priced per {form.isWeighted ? 'kg/L' : 'unit'}
            </label>
          </Field>
          <Field label="Shelf / aisle location">
            <input
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="e.g. Aisle 3, Shelf B"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        <Field label="Product image">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </Field>

        {!canEditPrice && (
          <p className="text-xs text-ink/40">Your role can't change prices — ask a manager to update them.</p>
        )}

        <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save product'}
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
