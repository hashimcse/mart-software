import { apiRequest } from './api';
import type { PaginatedPurchases, PaginatedSuppliers, Purchase, Supplier, SupplierPayment } from '../types/purchasing';

export function fetchSuppliers(params: URLSearchParams) {
  return apiRequest<PaginatedSuppliers>(`/suppliers?${params.toString()}`);
}
export function fetchSupplier(id: string) {
  return apiRequest<Supplier>(`/suppliers/${id}`);
}
export function createSupplier(data: Record<string, unknown>) {
  return apiRequest<Supplier>('/suppliers', { method: 'POST', body: data });
}
export function updateSupplier(id: string, data: Record<string, unknown>) {
  return apiRequest<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: data });
}
export function recordSupplierPayment(supplierId: string, data: Record<string, unknown>) {
  return apiRequest<SupplierPayment>(`/suppliers/${supplierId}/payments`, { method: 'POST', body: data });
}

export function fetchPurchases(params: URLSearchParams) {
  return apiRequest<PaginatedPurchases>(`/purchases?${params.toString()}`);
}
export function fetchPurchase(id: string) {
  return apiRequest<Purchase>(`/purchases/${id}`);
}
export function createPurchase(data: Record<string, unknown>) {
  return apiRequest<Purchase>('/purchases', { method: 'POST', body: data });
}
export function receivePurchase(id: string) {
  return apiRequest<Purchase>(`/purchases/${id}/receive`, { method: 'POST' });
}
export function invoicePurchase(id: string) {
  return apiRequest<Purchase>(`/purchases/${id}/invoice`, { method: 'POST' });
}
export function cancelPurchase(id: string) {
  return apiRequest<Purchase>(`/purchases/${id}/cancel`, { method: 'POST' });
}
