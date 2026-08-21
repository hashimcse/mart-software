import { apiRequest } from './api';
import type { AlertProduct, DashboardSummary, PaginatedMovements, Valuation } from '../types/inventory';

export function fetchMovements(params: URLSearchParams) {
  return apiRequest<PaginatedMovements>(`/inventory/movements?${params.toString()}`);
}
export function fetchLowStock() {
  return apiRequest<AlertProduct[]>('/inventory/low-stock');
}
export function fetchOutOfStock() {
  return apiRequest<AlertProduct[]>('/inventory/out-of-stock');
}
export function fetchExpiring(days = 14) {
  return apiRequest<AlertProduct[]>(`/inventory/expiring?days=${days}`);
}
export function fetchValuation() {
  return apiRequest<Valuation>('/inventory/valuation');
}
export function submitAdjustment(data: { productId: string; quantityChange: string; reason: string }) {
  return apiRequest('/inventory/adjustments', { method: 'POST', body: data });
}
export function submitDamaged(data: { productId: string; quantity: string; reason?: string }) {
  return apiRequest('/inventory/damaged', { method: 'POST', body: data });
}
export function submitExpired(data: { productId: string; quantity: string; reason?: string }) {
  return apiRequest('/inventory/expired', { method: 'POST', body: data });
}
export function fetchDashboardSummary() {
  return apiRequest<DashboardSummary>('/dashboard/summary');
}
