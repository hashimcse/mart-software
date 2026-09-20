import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchExpenses, createExpense, fetchOpenSession } from '../lib/cashRegisterApi';
import { fetchTerminals } from '../lib/posApi';
import { ApiError } from '../lib/api';
import type { Expense } from '../types/cashRegister';
import type { PaymentMethod, Terminal } from '../types/pos';

const CATEGORIES = ['Electricity', 'Rent', 'Salaries', 'Transportation', 'Maintenance', 'Miscellaneous'];
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'CREDIT'];

export default function Expenses() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('expenses.manage');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [drawFromTerminalId, setDrawFromTerminalId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchExpenses(new URLSearchParams({ pageSize: '30' }));
      setExpenses(result.items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchTerminals().then(setTerminals).catch(() => {});
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setError(null);
    setIsSaving(true);
    try {
      // A cash expense can optionally be drawn from a specific terminal's
      // open register, so it shows up in that drawer's reconciliation. If
      // there's no open session there, it just records without one.
      let cashSessionId: string | undefined;
      if (paymentMethod === 'CASH' && drawFromTerminalId) {
        const openSession = await fetchOpenSession(drawFromTerminalId).catch(() => null);
        cashSessionId = openSession?.id;
      }

      await createExpense({
        category: category === 'Other' ? customCategory : category,
        description: description || undefined,
        amount,
        paymentMethod,
        cashSessionId,
      });
      setDescription('');
      setAmount('');
      setCustomCategory('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this expense');
    } finally {
      setIsSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Expenses</h1>
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          Your role doesn't include permission to manage expenses.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Expenses</h1>
      <p className="mt-1 text-ink/60">Rent, utilities, salaries, and other store costs.</p>

      {error && <div className="mt-4 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-ink/10 bg-white p-4">
        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-ink/15 px-2 py-2 text-sm">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="Other">Other…</option>
          </select>
        </label>
        {category === 'Other' && (
          <label>
            <span className="mb-1 block text-sm font-medium text-ink/80">Category name</span>
            <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} className="rounded-md border border-ink/15 px-3 py-2 text-sm" />
          </label>
        )}
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-ink/80">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">Amount</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="figure w-28 rounded-md border border-ink/15 px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">Payment</span>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="rounded-md border border-ink/15 px-2 py-2 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {paymentMethod === 'CASH' && (
          <label>
            <span className="mb-1 block text-sm font-medium text-ink/80">Draw from register</span>
            <select value={drawFromTerminalId} onChange={(e) => setDrawFromTerminalId(e.target.value)} className="rounded-md border border-ink/15 px-2 py-2 text-sm">
              <option value="">Not from a register</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={!amount || (category === 'Other' && !customCategory) || isSaving}
          className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Record expense'}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/40">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Recorded by</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/40">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/40">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="px-4 py-2.5 font-medium text-ink">{exp.category}</td>
                <td className="px-4 py-2.5 text-ink/60">{exp.description ?? '—'}</td>
                <td className="px-4 py-2.5 text-ink/60">{exp.paymentMethod}</td>
                <td className="px-4 py-2.5 text-ink/60">{exp.employee?.name ?? '—'}</td>
                <td className="figure px-4 py-2.5 text-right font-medium text-ink">{Number(exp.amount).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-ink/50">{new Date(exp.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
