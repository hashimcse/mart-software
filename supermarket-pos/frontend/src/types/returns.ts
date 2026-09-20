export interface ReturnableLine {
  saleItemId: string;
  productName: string;
  sku: string;
  unitPrice: string;
  originalQuantity: string;
  alreadyReturned: string;
  returnable: string;
}

export interface ReturnableSale {
  saleId: string;
  invoiceNumber: string;
  status: string;
  lines: ReturnableLine[];
}

export interface ReturnItemResult {
  id: string;
  saleItemId: string;
  quantity: string;
  refundAmount: string;
  saleItem: { product: { name: string; sku: string } };
}

export interface ReturnResult {
  id: string;
  returnNumber: string;
  saleId: string;
  reason: string | null;
  totalRefund: string;
  items: ReturnItemResult[];
  sale: { invoiceNumber: string };
  createdAt: string;
}

export interface PurchaseReturnableLine {
  purchaseItemId: string;
  productName: string;
  sku: string;
  unitCost: string;
  originalQuantity: string;
  returnable: string;
}
