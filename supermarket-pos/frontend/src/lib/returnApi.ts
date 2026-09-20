import { apiRequest } from './api';
import type { ReturnableSale, ReturnResult, PurchaseReturnableLine } from '../types/returns';

export function fetchReturnableLines(saleId: string) {
  return apiRequest<ReturnableSale>(`/sales/${saleId}/returnable`);
}
export function createReturn(data: Record<string, unknown>) {
  return apiRequest<ReturnResult>('/returns', { method: 'POST', body: data });
}
export function fetchReturns(params: URLSearchParams) {
  return apiRequest<{ items: ReturnResult[]; page: number; totalPages: number }>(`/returns?${params.toString()}`);
}

export function fetchPurchaseReturnableLines(purchaseId: string) {
  return apiRequest<{ purchaseId: string; purchaseNumber: string; lines: PurchaseReturnableLine[] }>(
    `/purchases/${purchaseId}/returnable`,
  );
}
export function createPurchaseReturn(purchaseId: string, data: Record<string, unknown>) {
  return apiRequest(`/purchases/${purchaseId}/returns`, { method: 'POST', body: data });
}
