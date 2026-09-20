export type CashMovementType = 'SALE' | 'REFUND' | 'EXPENSE' | 'CASH_IN' | 'CASH_OUT';

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  amount: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
}

export type SessionStatus = 'OPEN' | 'CLOSED';

export interface CashSession {
  id: string;
  terminalId: string;
  terminal: { id: string; name: string };
  cashier: { id: string; name: string };
  openingCash: string;
  expectedCash: string | null;
  actualCash: string | null;
  difference: string | null;
  status: SessionStatus;
  openedAt: string;
  closedAt: string | null;
  movements: CashMovement[];
}

export interface CashSessionDetail extends CashSession {
  expectedSoFar: string;
  totalsByType: Record<string, string>;
}

export interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: string;
  paymentMethod: string;
  date: string;
  employee: { name: string } | null;
  notes: string | null;
}

export interface PaginatedExpenses {
  items: Expense[];
  page: number;
  totalPages: number;
  total: number;
}
