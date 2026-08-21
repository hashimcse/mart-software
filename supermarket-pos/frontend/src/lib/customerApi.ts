import { apiRequest } from './api';
import type { Customer } from '../types/pos';

export interface SaleSummary {
  id: string;
  invoiceNumber: string;
  total: string;
  status: string;
  createdAt: string;
  items: { id: string }[];
}

export interface CustomerPaymentRecord {
  id: string;
  amount: string;
  method: string;
  notes: string | null;
  createdAt: string;
}

export interface CustomerDetail extends Customer {
  address: string | null;
  recentSales: SaleSummary[];
  recentPayments: CustomerPaymentRecord[];
}

export interface PaginatedCustomers {
  items: Customer[];
  page: number;
  totalPages: number;
  total: number;
}

export function fetchCustomers(params: URLSearchParams) {
  return apiRequest<PaginatedCustomers>(`/customers?${params.toString()}`);
}
export function fetchCustomer(id: string) {
  return apiRequest<CustomerDetail>(`/customers/${id}`);
}
export function createCustomerFull(data: Record<string, unknown>) {
  return apiRequest<Customer>('/customers', { method: 'POST', body: data });
}
export function updateCustomerFull(id: string, data: Record<string, unknown>) {
  return apiRequest<Customer>(`/customers/${id}`, { method: 'PATCH', body: data });
}
export function recordCustomerPaymentFull(id: string, data: Record<string, unknown>) {
  return apiRequest<CustomerPaymentRecord>(`/customers/${id}/payments`, { method: 'POST', body: data });
}
export function adjustLoyaltyPoints(id: string, data: { pointsChange: number; reason: string }) {
  return apiRequest<Customer>(`/customers/${id}/loyalty-adjustments`, { method: 'POST', body: data });
}
