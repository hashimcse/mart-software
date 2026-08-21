import { useEffect, useRef, useState } from 'react';
import { searchCustomers, createCustomer } from '../../lib/posApi';
import type { Customer } from '../../types/pos';

interface Props {
  customer: Customer | null;
  onChange: (customer: Customer | null) => void;
}

export function CustomerPicker({ customer, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchCustomers(query.trim())
        .then(setResults)
        .catch(() => {});
    }, 250);
  }, [query]);

  async function handleQuickAdd() {
    if (!newName.trim()) return;
    const created = await createCustomer({ name: newName.trim(), phone: newPhone.trim() || undefined, type: 'REGISTERED' });
    onChange(created);
    setShowQuickAdd(false);
    setIsOpen(false);
    setNewName('');
    setNewPhone('');
  }

  if (customer) {
    return (
      <div className="flex items-center justify-between rounded-md border border-ink/15 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-ink">{customer.name}</p>
          {customer.phone && <p className="figure text-xs text-ink/40">{customer.phone}</p>}
        </div>
        <button onClick={() => onChange(null)} className="text-xs font-medium text-ink/40 hover:text-brick-600">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Walk-in — search or add a customer"
        className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
      />
      {isOpen && (query.trim() || showQuickAdd) && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-ink/10 bg-white shadow-lg">
          {!showQuickAdd &&
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c);
                  setIsOpen(false);
                  setQuery('');
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span className="font-medium text-ink">{c.name}</span>
                {c.phone && <span className="figure ml-2 text-ink/40">{c.phone}</span>}
              </button>
            ))}
          {!showQuickAdd && results.length === 0 && query.trim() && (
            <div className="px-3 py-2 text-sm text-ink/40">No matches.</div>
          )}
          <div className="border-t border-ink/10 p-2">
            {!showQuickAdd ? (
              <button onClick={() => setShowQuickAdd(true)} className="text-sm font-medium text-ledger-600 hover:text-ledger-700">
                + Add new customer
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="figure w-full rounded border border-ink/15 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={handleQuickAdd} className="rounded bg-ledger-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Save
                  </button>
                  <button onClick={() => setShowQuickAdd(false)} className="text-xs text-ink/50">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
