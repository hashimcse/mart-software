import { FormEvent, useEffect, useState } from 'react';
import {
  fetchOpenSession,
  fetchSession,
  openCashSession,
  addCashMovement,
  closeCashSession,
} from '../../lib/cashRegisterApi';
import { ApiError } from '../../lib/api';
import type { CashSessionDetail } from '../../types/cashRegister';

interface Props {
  terminalId: string;
  onClose: () => void;
}

const MOVEMENT_LABELS: Record<string, string> = {
  SALE: 'Cash sales',
  REFUND: 'Cash refunds',
  CASH_IN: 'Cash added',
  CASH_OUT: 'Cash removed',
  EXPENSE: 'Cash expenses',
};

export function CashRegisterPanel({ terminalId, onClose }: Props) {
  const [session, setSession] = useState<CashSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openingCash, setOpeningCash] = useState('');
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const open = await fetchOpenSession(terminalId);
      setSession(open ? await fetchSession(open.id) : null);
    } catch {
      setError('Could not load the cash register');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  async function handleOpen(e: FormEvent) {
    e.preventDefault();
    if (!openingCash) return;
    setError(null);
    setIsSaving(true);
    try {
      await openCashSession({ terminalId, openingCash });
      setOpeningCash('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the cash register');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMovement(e: FormEvent) {
    e.preventDefault();
    if (!session || !movementAmount) return;
    setError(null);
    setIsSaving(true);
    try {
      await addCashMovement(session.id, { type: movementType, amount: movementAmount, notes: movementNotes || undefined });
      setMovementAmount('');
      setMovementNotes('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record that movement');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClose(e: FormEvent) {
    e.preventDefault();
    if (!session || !actualCash) return;
    setError(null);
    setIsSaving(true);
    try {
      await closeCashSession(session.id, actualCash);
      setActualCash('');
      setShowCloseForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not close the cash register');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[28rem] overflow-y-auto border-t border-ink/10 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
        <span className="text-sm font-semibold text-ink">Cash register</span>
        <button onClick={onClose} className="text-ink/40 hover:text-ink">
          ✕
        </button>
      </div>

      <div className="p-4">
        {error && <div className="mb-3 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}
        {isLoading && <p className="text-sm text-ink/40">Loading…</p>}

        {!isLoading && !session && (
          <form onSubmit={handleOpen} className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-ink/80">No session open — opening cash</span>
              <input
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="20000.00"
                className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!openingCash || isSaving}
              className="rounded-md bg-ledger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ledger-700 disabled:opacity-50"
            >
              Open register
            </button>
          </form>
        )}

        {!isLoading && session && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <MiniStat label="Opening cash" value={session.openingCash} />
              <MiniStat label="Expected now" value={session.expectedSoFar} />
              <MiniStat label="Opened" value={new Date(session.openedAt).toLocaleTimeString()} isText />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-ink/60 sm:grid-cols-3">
              {Object.entries(MOVEMENT_LABELS).map(([type, label]) => (
                <div key={type} className="flex justify-between rounded-md border border-ink/10 px-2 py-1.5">
                  <span>{label}</span>
                  <span className="figure text-ink">{session.totalsByType[type] ?? '0.00'}</span>
                </div>
              ))}
            </div>

            {!showCloseForm ? (
              <>
                <form onSubmit={handleMovement} className="flex items-end gap-2 border-t border-ink/10 pt-3">
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as 'CASH_IN' | 'CASH_OUT')}
                    className="rounded-md border border-ink/15 px-2 py-2 text-sm"
                  >
                    <option value="CASH_IN">Add cash</option>
                    <option value="CASH_OUT">Remove cash</option>
                  </select>
                  <input
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0.00"
                    className="figure w-24 rounded-md border border-ink/15 px-3 py-2 text-sm"
                  />
                  <input
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="Note (optional)"
                    className="flex-1 rounded-md border border-ink/15 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!movementAmount || isSaving}
                    className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper disabled:opacity-50"
                  >
                    Record
                  </button>
                </form>
                <button onClick={() => setShowCloseForm(true)} className="text-sm font-medium text-brick-600 hover:text-brick-600/80">
                  Close register
                </button>
              </>
            ) : (
              <form onSubmit={handleClose} className="space-y-2 border-t border-ink/10 pt-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-ink/80">Actual cash counted</span>
                  <input
                    autoFocus
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder={session.expectedSoFar}
                    className="figure w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                  />
                </label>
                {actualCash && (
                  <p className="text-sm text-ink/60">
                    Difference:{' '}
                    <span className={`figure font-semibold ${Number(actualCash) - Number(session.expectedSoFar) < 0 ? 'text-brick-600' : 'text-ledger-700'}`}>
                      {(Number(actualCash) - Number(session.expectedSoFar)).toFixed(2)}
                    </span>
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCloseForm(false)} className="rounded-md border border-ink/15 px-3 py-2 text-sm font-medium text-ink/70 hover:bg-paper">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!actualCash || isSaving}
                    className="rounded-md bg-brick-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brick-600 disabled:opacity-50"
                  >
                    Confirm close
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, isText }: { label: string; value: string; isText?: boolean }) {
  return (
    <div className="rounded-lg border border-ink/10 p-2.5">
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold text-ink ${isText ? '' : 'figure'}`}>{isText ? value : Number(value).toFixed(2)}</p>
    </div>
  );
}
