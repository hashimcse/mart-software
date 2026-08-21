export interface SupplierBalance {
  openingBalance: string;
  totalPurchases: string;
  totalPaid: string;
  outstandingBalance: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  openingBalance: string;
  isActive: boolean;
  balance?: SupplierBalance;
  payments?: SupplierPayment[];
}

export type PurchaseStatus = 'ORDERED' | 'RECEIVED' | 'INVOICED' | 'PAID' | 'CANCELLED';

export interface PurchaseItem {
  id: string;
  productId: string;
  product: { name: string; sku: string };
  quantity: string;
  unitCost: string;
  subtotal: string;
}

export interface SupplierPayment {
  id: string;
  amount: string;
  method: string;
  purchaseId: string | null;
  createdAt: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplier: Supplier;
  status: PurchaseStatus;
  subtotal: string;
  taxAmount: string;
  total: string;
  items: PurchaseItem[];
  payments: SupplierPayment[];
  createdAt: string;
  receivedAt: string | null;
}

export interface PaginatedSuppliers {
  items: Supplier[];
  page: number;
  totalPages: number;
  total: number;
}

export interface PaginatedPurchases {
  items: Purchase[];
  page: number;
  totalPages: number;
  total: number;
}
