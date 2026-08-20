export interface Staff {
  id: string;
  fullName: string;
  username: string;
  pinHash: string;
  pinSalt: string;
  role: 'owner' | 'manager' | 'sales' | 'inventory' | 'technician' | 'accountant';
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  commissionPercent: number;
  dateJoined: string;
}

export interface Session {
  id: string;
  staffId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  brand: string;
  model: string;
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  discountPrice: number;
  stock: number;
  minStock: number;
  supplierId: string;
  warrantyMonths: number;
  requiresSerial: boolean;
  requiresImei: boolean;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  icon: string;
  createdAt: string;
}

export interface DeviceUnit {
  id: string;
  productId: string;
  serial: string;
  imei1: string;
  imei2: string;
  color: string;
  storage: string;
  ram: string;
  status: 'in_stock' | 'sold';
  saleId: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  location: string;
  address: string;
  amountOwed: number;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
  deviceUnitId?: string;
  serial?: string;
  imei1?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  staffId: string;
  staffName: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'mpesa' | 'card' | 'bank_transfer' | 'split';
  paymentStatus: 'pending' | 'paid' | 'failed';
  mpesaTransactionId: string;
  status: 'completed' | 'refunded' | 'partially_refunded' | 'cancelled';
  date: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  customerType: 'walk_in' | 'regular' | 'business';
  totalSpent: number;
  outstandingBalance: number;
  createdAt: string;
}

export interface MpesaTransaction {
  id: string;
  saleId: string;
  phone: string;
  amount: number;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | 'timeout';
  createdAt: string;
  updatedAt: string;
}

export interface Warranty {
  id: string;
  saleId: string;
  invoiceNumber: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  serial: string;
  imei1: string;
  warrantyMonths: number;
  startDate: string;
  expiryDate: string;
}

export interface Repair {
  id: string;
  jobCardNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  brand: string;
  model: string;
  serialOrImei: string;
  problemDescription: string;
  technicianId: string;
  technicianName: string;
  estimatedCost: number;
  finalCost: number;
  deposit: number;
  balance: number;
  status: 'received' | 'diagnosing' | 'awaiting_approval' | 'awaiting_parts' | 'repairing' | 'ready_for_collection' | 'collected' | 'cancelled';
  dateReceived: string;
  expectedDate: string;
  dateCompleted: string;
}

export interface Settings {
  id: string;
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  location: string;
  currency: string;
  taxRate: number;
  invoicePrefix: string;
  invoiceCounter: number;
  jobCardCounter: number;
  receiptFooter: string;
  warrantyDefaultMonths: number;
  mpesaShortcode: string;
  negativeInventoryAllowed: boolean;
  cashierDiscountCapPercent: number;
}

export interface CashRegister {
  id: string;
  date: string;
  openingBalance: number;
  openedBy: string;
  createdAt: string;
}
