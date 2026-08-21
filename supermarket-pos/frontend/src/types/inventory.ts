export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGED' | 'EXPIRED';

export interface InventoryMovement {
  id: string;
  productId: string;
  product: { name: string; sku: string };
  type: MovementType;
  quantity: string;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  user: { name: string } | null;
  createdAt: string;
}

export interface AlertProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: string;
  minStock: string;
  expiryDate: string | null;
  unit: { abbreviation: string };
  category: { name: string } | null;
}

export interface Valuation {
  totalCost: string;
  totalRetail: string;
  potentialProfit: string;
  productCount: number;
}

export interface DashboardSummary {
  todaySalesTotal: string;
  todayTransactionCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingPayments: string;
}

export interface PaginatedMovements {
  items: InventoryMovement[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
