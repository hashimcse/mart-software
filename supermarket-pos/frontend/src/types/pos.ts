export interface Terminal {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
}

export interface CustomerBalance {
  totalCredit: string;
  totalPaid: string;
  outstandingBalance: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: 'WALK_IN' | 'REGISTERED' | 'CREDIT';
  loyaltyPoints: number;
  creditLimit: string;
  balance?: CustomerBalance;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'MOBILE_WALLET' | 'CREDIT';

// A line in the cart being built at the register. Distinct from the
// backend's SaleItem — this carries display fields (name, image, stock)
// the UI needs that the API doesn't return until the sale is submitted.
export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  unitAbbreviation: string;
  unitPrice: string;
  quantity: string;
  discount: string;
  isWeighted: boolean;
  availableStock: string;
  taxRate: string | null;
  taxInclusive: boolean;
}

export interface HeldBill {
  id: string;
  terminalId: string;
  customerId: string | null;
  customer: Customer | null;
  cashier: { id: string; name: string };
  cartData: { cart: CartLine[]; note?: string };
  note: string | null;
  createdAt: string;
}

export interface SaleItemResult {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  subtotal: string;
  product: { name: string; sku: string };
}

export interface SaleResult {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  status: string;
  createdAt: string;
  items: SaleItemResult[];
  payments: { method: PaymentMethod; amount: string }[];
  customer: Customer | null;
  cashier: { id: string; name: string };
}

export interface CreateSaleResponse {
  sale: SaleResult;
  changeDue: string;
  loyaltyPointsEarned: number;
}

export type Settings = Record<string, string>;
