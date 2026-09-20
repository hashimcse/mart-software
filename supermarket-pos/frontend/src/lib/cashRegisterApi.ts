import { apiRequest } from './api';
import type { CashSession, CashSessionDetail, Expense, PaginatedExpenses } from '../types/cashRegister';

export function fetchOpenSession(terminalId: string) {
  return apiRequest<CashSession | null>(`/cash-sessions/open?terminalId=${terminalId}`);
}
export function fetchSession(id: string) {
  return apiRequest<CashSessionDetail>(`/cash-sessions/${id}`);
}
export function fetchRecentSessions(terminalId?: string) {
  const params = new URLSearchParams(terminalId ? { terminalId } : {});
  return apiRequest<CashSession[]>(`/cash-sessions?${params.toString()}`);
}
export function openCashSession(data: { terminalId: string; openingCash: string }) {
  return apiRequest<CashSession>('/cash-sessions', { method: 'POST', body: data });
}
export function addCashMovement(sessionId: string, data: { type: 'CASH_IN' | 'CASH_OUT'; amount: string; notes?: string }) {
  return apiRequest(`/cash-sessions/${sessionId}/movements`, { method: 'POST', body: data });
}
export function closeCashSession(sessionId: string, actualCash: string) {
  return apiRequest<CashSession>(`/cash-sessions/${sessionId}/close`, { method: 'POST', body: { actualCash } });
}

export function fetchExpenses(params: URLSearchParams) {
  return apiRequest<PaginatedExpenses>(`/expenses?${params.toString()}`);
}
export function createExpense(data: Record<string, unknown>) {
  return apiRequest<Expense>('/expenses', { method: 'POST', body: data });
}
