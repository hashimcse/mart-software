export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  taxId: string | null;
  _count?: { products: number; children: number };
}

export interface Brand {
  id: string;
  name: string;
  _count?: { products: number };
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  isFractional: boolean;
}

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  category: Category | null;
  brandId: string | null;
  brand: Brand | null;
  unitId: string;
  unit: Unit;
  purchasePrice: string;
  sellingPrice: string;
  wholesalePrice: string | null;
  taxId: string | null;
  tax: { id: string; name: string; rate: string; isInclusive: boolean } | null;
  currentStock: string;
  minStock: string;
  maxStock: string | null;
  isWeighted: boolean;
  batchNumber: string | null;
  expiryDate: string | null;
  imageUrl: string | null;
  description: string | null;
  location: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProducts {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
