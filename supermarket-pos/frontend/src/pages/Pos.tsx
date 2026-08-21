import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import {
  fetchTerminals,
  fetchHeldBills,
  holdBill,
  deleteHeldBill,
  createSale,
  fetchRecentSales,
  fetchSettings,
  printSaleOverNetwork,
} from '../lib/posApi';
import { printReceiptInBrowser } from '../lib/receiptPrint';
import { BarcodeSearchInput } from '../components/pos/BarcodeSearchInput';
import { CartTable } from '../components/pos/CartTable';
import { CartSummary, PaymentLine } from '../components/pos/CartSummary';
import { CustomerPicker } from '../components/pos/CustomerPicker';
import { HeldBillsPanel } from '../components/pos/HeldBillsPanel';
import { SaleCompleteModal } from '../components/pos/SaleCompleteModal';
import type { Product } from '../types/catalog';
import type { CartLine, Customer, HeldBill as HeldBillType, SaleResult, Settings, Terminal } from '../types/pos';

const DEFAULT_PAYMENTS: PaymentLine[] = [{ method: 'CASH', amount: '' }];

export default function Pos() {
  const { hasPermission } = useAuth();
  const canSell = hasPermission('sales.create');

  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cartDiscount, setCartDiscount] = useState('0');
  const [payments, setPayments] = useState<PaymentLine[]>(DEFAULT_PAYMENTS);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [heldBills, setHeldBills] = useState<HeldBillType[]>([]);
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [recentSales, setRecentSales] = useState<SaleResult[]>([]);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [completed, setCompleted] = useState<{ sale: SaleResult; changeDue: string; loyaltyPointsEarned: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printingRowId, setPrintingRowId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstPaymentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTerminals()
      .then((list) => {
        setTerminals(list);
        if (list.length > 0) setTerminalId(list[0].id);
      })
      .catch(() => setError('Could not load terminals'));
    fetchSettings().then(setSettings).catch(() => {});
  }, []);

  const refreshHeldBills = useCallback(() => {
    if (!terminalId) return;
    fetchHeldBills(terminalId).then(setHeldBills).catch(() => {});
  }, [terminalId]);

  useEffect(() => {
    refreshHeldBills();
  }, [refreshHeldBills]);

  const refreshRecentSales = useCallback(() => {
    fetchRecentSales(terminalId)
      .then((r) => setRecentSales(r.items))
      .catch(() => {});
  }, [terminalId]);

  useEffect(() => {
    if (showRecentSales) refreshRecentSales();
  }, [showRecentSales, refreshRecentSales]);

  function addProductToCart(product: Product) {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        const nextQty = (Number(existing.quantity) + 1).toFixed(product.isWeighted ? 3 : 0);
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: nextQty } : l));
      }
      const line: CartLine = {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        unitAbbreviation: product.unit.abbreviation,
        unitPrice: product.sellingPrice,
        quantity: product.isWeighted ? '1.000' : '1',
        discount: '0',
        isWeighted: product.isWeighted,
        availableStock: product.currentStock,
        taxRate: product.tax?.rate ?? null,
        taxInclusive: product.tax?.isInclusive ?? false,
      };
      return [...prev, line];
    });
  }

  function updateQuantity(productId: string, quantity: string) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  }

  function updateDiscount(productId: string, discount: string) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, discount } : l)));
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
    setSelectedProductId((id) => (id === productId ? null : id));
  }

  function resetSaleState() {
    setCart([]);
    setCustomer(null);
    setCartDiscount('0');
    setPayments(DEFAULT_PAYMENTS);
    setSelectedProductId(null);
  }

  function clearCart() {
    if (cart.length > 0 && !window.confirm('Clear the current bill?')) return;
    resetSaleState();
  }

  async function handleHold() {
    if (cart.length === 0 || !terminalId) return;
    try {
      await holdBill({ terminalId, customerId: customer?.id ?? null, cartData: { cart } });
      resetSaleState();
      refreshHeldBills();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not hold this bill');
    }
  }

  function resumeHeldBill(bill: HeldBillType) {
    setCart(bill.cartData.cart);
    setCustomer(bill.customer);
    setShowHeldBills(false);
    deleteHeldBill(bill.id)
      .then(refreshHeldBills)
      .catch(() => {});
  }

  function discardHeldBill(bill: HeldBillType) {
    if (!window.confirm('Discard this held bill? This cannot be undone.')) return;
    deleteHeldBill(bill.id)
      .then(refreshHeldBills)
      .catch(() => setError('Could not discard that bill'));
  }

  async function handleComplete() {
    if (cart.length === 0 || !terminalId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        terminalId,
        customerId: customer?.id ?? null,
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, discount: l.discount || '0' })),
        discountAmount: cartDiscount || '0',
        payments: payments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: p.amount })),
      };
      const result = await createSale(payload);
      setCompleted(result);
      resetSaleState();
      refreshRecentSales();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this sale');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePrintRecent(saleId: string) {
    setPrintingRowId(saleId);
    try {
      if (settings['pos.printerMode'] === 'network') {
        await printSaleOverNetwork(saleId);
      } else {
        await printReceiptInBrowser(saleId);
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not print this receipt');
    } finally {
      setPrintingRowId(null);
    }
  }

  // Keyboard shortcuts (spec section 27).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHold();
      } else if (e.key === 'F5') {
        e.preventDefault();
        firstPaymentInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleComplete();
      } else if (e.key === 'Escape') {
        setShowHeldBills(false);
        setShowRecentSales(false);
      } else if (e.key === 'Delete' && selectedProductId) {
        removeItem(selectedProductId);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, customer, cartDiscount, payments, terminalId, selectedProductId]);

  if (!canSell) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">POS</h1>
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 bg-white p-6 text-sm text-ink/60">
          Your role doesn't include permission to process sales.
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink/10 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-semibold text-ink">POS</h1>
          {terminals.length > 1 && (
            <select
              value={terminalId}
              onChange={(e) => setTerminalId(e.target.value)}
              className="rounded-md border border-ink/15 px-2 py-1 text-sm"
            >
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button onClick={() => setShowHeldBills((v) => !v)} className="font-medium text-ink/60 hover:text-ink">
            Held bills {heldBills.length > 0 && `(${heldBills.length})`}
          </button>
          <button onClick={() => setShowRecentSales((v) => !v)} className="font-medium text-ink/60 hover:text-ink">
            Recent sales
          </button>
        </div>
      </div>

      {error && <div className="mx-6 mt-3 rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-ink/10 bg-white p-4">
            <BarcodeSearchInput inputRef={searchInputRef} onAdd={addProductToCart} onError={setError} />
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            <CartTable
              lines={cart}
              selectedProductId={selectedProductId}
              onSelect={setSelectedProductId}
              onQuantityChange={updateQuantity}
              onDiscountChange={updateDiscount}
              onRemove={removeItem}
            />
          </div>
        </div>

        <div className="w-80 shrink-0 border-l border-ink/10 bg-white">
          <div className="border-b border-ink/10 p-4">
            <CustomerPicker customer={customer} onChange={setCustomer} />
          </div>
          <CartSummary
            lines={cart}
            cartDiscount={cartDiscount}
            onCartDiscountChange={setCartDiscount}
            payments={payments}
            onPaymentsChange={setPayments}
            onHold={handleHold}
            onClear={clearCart}
            onComplete={handleComplete}
            isSubmitting={isSubmitting}
            firstPaymentInputRef={firstPaymentInputRef}
          />
        </div>
      </div>

      {showHeldBills && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-80 overflow-y-auto border-t border-ink/10 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
            <span className="text-sm font-semibold text-ink">Held bills</span>
            <button onClick={() => setShowHeldBills(false)} className="text-ink/40 hover:text-ink">
              ✕
            </button>
          </div>
          <HeldBillsPanel bills={heldBills} onResume={resumeHeldBill} onDiscard={discardHeldBill} />
        </div>
      )}

      {showRecentSales && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-80 overflow-y-auto border-t border-ink/10 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
            <span className="text-sm font-semibold text-ink">Recent sales</span>
            <button onClick={() => setShowRecentSales(false)} className="text-ink/40 hover:text-ink">
              ✕
            </button>
          </div>
          <div className="divide-y divide-ink/5">
            {recentSales.length === 0 && <p className="p-4 text-sm text-ink/40">No sales yet.</p>}
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="figure text-ink">{s.invoiceNumber}</span>
                <span className="text-ink/50">{new Date(s.createdAt).toLocaleTimeString()}</span>
                <span className="figure font-medium text-ink">{Number(s.total).toFixed(2)}</span>
                <button
                  onClick={() => handlePrintRecent(s.id)}
                  disabled={printingRowId === s.id}
                  className="text-xs font-medium text-ledger-600 hover:text-ledger-700 disabled:opacity-50"
                >
                  {printingRowId === s.id ? 'Printing…' : 'Print'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed && (
        <SaleCompleteModal
          sale={completed.sale}
          changeDue={completed.changeDue}
          loyaltyPointsEarned={completed.loyaltyPointsEarned}
          printerMode={settings['pos.printerMode'] ?? 'browser'}
          onClose={() => setCompleted(null)}
        />
      )}
    </div>
  );
}
