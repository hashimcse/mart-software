import { apiRequest, apiUpload } from './api';
import type { Brand, Category, PaginatedProducts, Product, Unit } from '../types/catalog';

export function fetchProducts(params: URLSearchParams) {
  return apiRequest<PaginatedProducts>(`/products?${params.toString()}`);
}
export function fetchProduct(id: string) {
  return apiRequest<Product>(`/products/${id}`);
}
export function createProduct(data: Record<string, unknown>) {
  return apiRequest<Product>('/products', { method: 'POST', body: data });
}
export function updateProduct(id: string, data: Record<string, unknown>) {
  return apiRequest<Product>(`/products/${id}`, { method: 'PATCH', body: data });
}
export function setProductStatus(id: string, status: string) {
  return apiRequest<Product>(`/products/${id}/status`, { method: 'PATCH', body: { status } });
}
export function uploadProductImage(id: string, formData: FormData) {
  return apiUpload<Product>(`/products/${id}/image`, formData);
}

export function fetchCategories() {
  return apiRequest<Category[]>('/categories');
}
export function createCategory(data: Record<string, unknown>) {
  return apiRequest<Category>('/categories', { method: 'POST', body: data });
}
export function updateCategory(id: string, data: Record<string, unknown>) {
  return apiRequest<Category>(`/categories/${id}`, { method: 'PATCH', body: data });
}
export function deleteCategory(id: string) {
  return apiRequest<void>(`/categories/${id}`, { method: 'DELETE' });
}

export function fetchBrands() {
  return apiRequest<Brand[]>('/brands');
}
export function createBrand(data: Record<string, unknown>) {
  return apiRequest<Brand>('/brands', { method: 'POST', body: data });
}
export function updateBrand(id: string, data: Record<string, unknown>) {
  return apiRequest<Brand>(`/brands/${id}`, { method: 'PATCH', body: data });
}
export function deleteBrand(id: string) {
  return apiRequest<void>(`/brands/${id}`, { method: 'DELETE' });
}

export function fetchUnits() {
  return apiRequest<Unit[]>('/units');
}
