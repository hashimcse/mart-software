import { apiRequest } from './api';
import type { Product, PaginatedProducts } from '../types/catalog';
import type { CreateSaleResponse, Customer, HeldBill, SaleResult, Settings, Terminal } from '../types/pos';

export function fetchTerminals() {
  return apiRequest<Terminal[]>('/terminals');
}

export function lookupByBarcode(barcode: string) {
  return apiRequest<Product>(`/products/barcode/${encodeURIComponent(barcode)}`);
}

export function searchProducts(query: string) {
  const params = new URLSearchParams({ search: query, pageSize: '8', status: 'ACTIVE' });
  return apiRequest<PaginatedProducts>(`/products?${params.toString()}`);
}

export async function searchCustomers(query: string) {
  const params = new URLSearchParams(query ? { search: query } : {});
  const result = await apiRequest<{ items: Customer[] }>(`/customers?${params.toString()}`);
  return result.items;
}

export function createCustomer(data: { name: string; phone?: string; type?: string }) {
  return apiRequest<Customer>('/customers', { method: 'POST', body: data });
}

export function createSale(data: Record<string, unknown>) {
  return apiRequest<CreateSaleResponse>('/sales', { method: 'POST', body: data });
}

export function fetchRecentSales(terminalId?: string) {
  const params = new URLSearchParams({ pageSize: '10' });
  if (terminalId) params.set('terminalId', terminalId);
  return apiRequest<{ items: SaleResult[] }>(`/sales?${params.toString()}`);
}

export function fetchSale(id: string) {
  return apiRequest<SaleResult>(`/sales/${id}`);
}

export function fetchSettings() {
  return apiRequest<Settings>('/settings');
}

export async function updateSetting(key: string, value: string) {
  const result = await apiRequest<{ key: string; value: unknown }>(`/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { value },
  });
  window.dispatchEvent(new Event('pos:settings-updated'));
  return result;
}

export function sendTestPrint() {
  return apiRequest<{ status: string }>('/settings/test-print', { method: 'POST' });
}

export function printSaleOverNetwork(saleId: string) {
  return apiRequest<{ status: string }>(`/sales/${saleId}/print`, { method: 'POST' });
}

export function fetchHeldBills(terminalId: string) {
  const params = new URLSearchParams({ terminalId });
  return apiRequest<HeldBill[]>(`/held-bills?${params.toString()}`);
}

export function holdBill(data: Record<string, unknown>) {
  return apiRequest<HeldBill>('/held-bills', { method: 'POST', body: data });
}

export function deleteHeldBill(id: string) {
  return apiRequest<void>(`/held-bills/${id}`, { method: 'DELETE' });
}
