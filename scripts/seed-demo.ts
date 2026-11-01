import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed demo data.');

const tables = [
  'staff', 'sessions', 'settings', 'categories', 'products', 'deviceUnits', 'suppliers',
  'purchases', 'customers', 'sales', 'payments', 'mpesaTransactions', 'warranties',
  'repairs', 'expenses', 'notifications', 'refunds', 'auditLogs', 'meta', 'cashRegisters',
];
const sql = neon(connectionString);
const target = new URL(connectionString);
console.log(`Preparing demo data for database host ${target.hostname.replace(/^[^.]+/, '***')}.`);

for (const table of tables) {
  await sql.query(`CREATE TABLE IF NOT EXISTS "${table}" (
    id text PRIMARY KEY,
    data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql.query(`CREATE INDEX IF NOT EXISTS "${table}_data_idx" ON "${table}" USING gin (data)`);
}

const existingRows: { table_name: string; row_count: number }[] = [];
for (const table of tables) {
  const [result] = await sql.query(`SELECT count(*)::int AS row_count FROM "${table}"`);
  if (result.row_count > 0) existingRows.push({ table_name: table, row_count: result.row_count });
}
if (existingRows.length > 0) {
  throw new Error(`Demo seeding stopped because the target database contains data (${existingRows.map((row) => row.table_name).join(', ')}). Clear or verify the target before rerunning.`);
}

const { db } = await import('../backend/lib/neon');
const { hashPin, newSalt } = await import('../backend/lib/helpers');
const now = new Date();
const daysAgo = (days: number): string => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const makeId = (): string => randomUUID();
const ownerId = makeId();
const staff = [
  { id: ownerId, fullName: 'Demo Owner', username: 'admin', pin: '2114', role: 'owner', commissionPercent: 0 },
  { id: makeId(), fullName: 'Demo Manager', username: 'manager', pin: '2468', role: 'manager', commissionPercent: 0 },
  { id: makeId(), fullName: 'Demo Sales Associate', username: 'sales.demo', pin: '1357', role: 'sales', commissionPercent: 2 },
  { id: makeId(), fullName: 'Demo Technician', username: 'tech.demo', pin: '9753', role: 'technician', commissionPercent: 0 },
  { id: makeId(), fullName: 'Demo Accountant', username: 'accounts.demo', pin: '8642', role: 'accountant', commissionPercent: 0 },
].map(({ pin, ...person }) => {
  const pinSalt = newSalt();
  return {
    ...person,
    pinHash: hashPin(pin, pinSalt),
    pinSalt,
    phone: '0000000000',
    email: `${person.username.replace('.', '-')}@example.invalid`,
    status: 'active',
    dateJoined: daysAgo(90),
  };
});

const categories = [
  'Smartphones', 'Laptops & Tablets', 'Audio', 'Accessories', 'Networking', 'Power & Storage',
].map((name) => ({ id: makeId(), name }));
const suppliers = [
  { name: 'Demo Nairobi Devices', company: 'Demo Nairobi Devices Ltd', location: 'Nairobi', address: 'Demo stockist' },
  { name: 'Sample Tech Distributors', company: 'Sample Tech Distributors', location: 'Westlands', address: 'Demo stockist' },
  { name: 'Showcase Accessories Supply', company: 'Showcase Accessories Supply', location: 'Industrial Area', address: 'Demo stockist' },
].map((supplier) => ({
  id: makeId(), ...supplier, phone: '0000000000',
  email: `${supplier.name.toLowerCase().replaceAll(' ', '-')}@example.invalid`,
  amountOwed: 0, createdAt: daysAgo(80),
}));

const products = [
  { name: 'Galaxy A55 5G (Demo)', sku: 'DEMO-PH-001', category: 0, brand: 'Samsung', model: 'Galaxy A55 5G', purchasePrice: 52000, sellingPrice: 64999, stock: 7, minStock: 3, serial: true, icon: '📱' },
  { name: 'iPhone 15 (Demo)', sku: 'DEMO-PH-002', category: 0, brand: 'Apple', model: 'iPhone 15', purchasePrice: 112000, sellingPrice: 129999, stock: 5, minStock: 2, serial: true, icon: '📱' },
  { name: 'Redmi Note 13 (Demo)', sku: 'DEMO-PH-003', category: 0, brand: 'Xiaomi', model: 'Redmi Note 13', purchasePrice: 22000, sellingPrice: 27999, stock: 8, minStock: 3, serial: true, icon: '📱' },
  { name: 'Tecno Camon 30 (Demo)', sku: 'DEMO-PH-004', category: 0, brand: 'Tecno', model: 'Camon 30', purchasePrice: 27000, sellingPrice: 33999, stock: 2, minStock: 4, serial: true, icon: '📱' },
  { name: 'HP ProBook 450 (Demo)', sku: 'DEMO-LT-001', category: 1, brand: 'HP', model: 'ProBook 450', purchasePrice: 79000, sellingPrice: 94999, stock: 4, minStock: 2, serial: true, icon: '💻' },
  { name: 'Lenovo Tab M11 (Demo)', sku: 'DEMO-TB-001', category: 1, brand: 'Lenovo', model: 'Tab M11', purchasePrice: 22000, sellingPrice: 28999, stock: 5, minStock: 2, serial: true, icon: '📱' },
  { name: 'JBL Tune 520BT (Demo)', sku: 'DEMO-AU-001', category: 2, brand: 'JBL', model: 'Tune 520BT', purchasePrice: 4800, sellingPrice: 6499, stock: 14, minStock: 4, icon: '🎧' },
  { name: 'Soundcore Motion Mini (Demo)', sku: 'DEMO-AU-002', category: 2, brand: 'Soundcore', model: 'Motion Mini', purchasePrice: 3900, sellingPrice: 5499, stock: 3, minStock: 5, icon: '🔊' },
  { name: '65W USB-C Charger (Demo)', sku: 'DEMO-AC-001', category: 3, brand: 'Anker', model: 'Nano 65W', purchasePrice: 2800, sellingPrice: 3999, stock: 22, minStock: 6, icon: '🔌' },
  { name: 'USB-C Cable 2m (Demo)', sku: 'DEMO-AC-002', category: 3, brand: 'Star', model: 'Braided USB-C', purchasePrice: 350, sellingPrice: 799, stock: 35, minStock: 10, icon: '🔌' },
  { name: 'Wi-Fi 6 Router (Demo)', sku: 'DEMO-NW-001', category: 4, brand: 'TP-Link', model: 'Archer AX23', purchasePrice: 6500, sellingPrice: 8499, stock: 6, minStock: 2, icon: '📡' },
  { name: '20,000mAh Power Bank (Demo)', sku: 'DEMO-PW-001', category: 5, brand: 'Oraimo', model: 'Traveler 4', purchasePrice: 2300, sellingPrice: 3499, stock: 9, minStock: 3, icon: '🔋' },
  { name: '256GB USB Drive (Demo)', sku: 'DEMO-ST-001', category: 5, brand: 'SanDisk', model: 'Ultra Flair', purchasePrice: 1500, sellingPrice: 2299, stock: 4, minStock: 5, icon: '💾' },
].map((product, index) => ({
  id: makeId(),
  name: product.name,
  sku: product.sku,
  barcode: `DEMO-${String(index + 1).padStart(6, '0')}`,
  categoryId: categories[product.category].id,
  brand: product.brand,
  model: product.model,
  description: 'Synthetic sample item for product demonstrations; not a real stock record.',
  purchasePrice: product.purchasePrice,
  sellingPrice: product.sellingPrice,
  wholesalePrice: Math.round(product.sellingPrice * 0.96),
  discountPrice: Math.round(product.sellingPrice * 0.98),
  stock: product.stock,
  minStock: product.minStock,
  supplierId: suppliers[index % suppliers.length].id,
  warrantyMonths: product.serial ? 12 : 0,
  requiresSerial: !!product.serial,
  requiresImei: index < 4,
  status: product.stock <= 0 ? 'out_of_stock' : product.stock <= product.minStock ? 'low_stock' : 'in_stock',
  icon: product.icon,
  createdAt: daysAgo(75 - index),
}));

await db.add('staff', staff);
await db.add('categories', categories);
await db.add('suppliers', suppliers);
await db.add('products', products);

const devicesByProduct = new Map<string, { id: string; serial: string; imei1: string }[]>();
for (let index = 0; index < 6; index += 1) {
  const product = products[index];
  const units = Array.from({ length: Math.min(product.stock, 4) }, (_, unitIndex) => ({
    id: makeId(),
    productId: product.id,
    serial: `DEMO-SN-${String(index + 1).padStart(2, '0')}-${String(unitIndex + 1).padStart(3, '0')}`,
    imei1: `000000000000${String(index * 10 + unitIndex + 1).padStart(2, '0')}`,
    imei2: '',
    color: ['Black', 'Blue', 'Silver', 'Graphite'][unitIndex % 4],
    storage: index < 4 ? '128GB' : '256GB',
    ram: index < 4 ? '8GB' : '16GB',
    status: 'in_stock',
    saleId: '',
    createdAt: daysAgo(60 - unitIndex),
  }));
  devicesByProduct.set(product.id, units);
  await db.add('deviceUnits', units);
}

const customers = Array.from({ length: 12 }, (_, index) => ({
  id: makeId(),
  fullName: `Demo Customer ${String(index + 1).padStart(2, '0')}`,
  phone: `000000${String(index + 1).padStart(4, '0')}`,
  email: `customer${String(index + 1).padStart(2, '0')}@example.invalid`,
  address: ['Nairobi CBD', 'Westlands', 'Kilimani', 'Parklands'][index % 4] + ' (demo)',
  customerType: (['regular', 'business', 'walk_in'][index % 3]),
  totalSpent: 0,
  outstandingBalance: 0,
  createdAt: daysAgo(55 - index),
}));
await db.add('customers', customers);

const purchaseRows = [
  { supplier: 0, product: 0, qty: 4, paidRatio: 1, days: 48 },
  { supplier: 1, product: 6, qty: 12, paidRatio: 0.8, days: 35 },
  { supplier: 2, product: 8, qty: 20, paidRatio: 1, days: 22 },
  { supplier: 0, product: 10, qty: 5, paidRatio: 0.6, days: 15 },
  { supplier: 1, product: 11, qty: 8, paidRatio: 1, days: 7 },
];
const purchases = purchaseRows.map((row) => {
  const product = products[row.product];
  const totalCost = row.qty * product.purchasePrice;
  const amountPaid = Math.round(totalCost * row.paidRatio);
  return {
    id: makeId(),
    supplierId: suppliers[row.supplier].id,
    items: [{ productId: product.id, productName: product.name, qty: row.qty, purchasePrice: product.purchasePrice }],
    totalCost,
    amountPaid,
    balance: totalCost - amountPaid,
    status: amountPaid < totalCost ? 'partial' : 'received',
    date: daysAgo(row.days),
    receivedBy: staff[1].fullName,
  };
});
await db.add('purchases', purchases);
for (const supplier of suppliers) {
  supplier.amountOwed = purchases
    .filter((purchase) => purchase.supplierId === supplier.id)
    .reduce((sum, purchase) => sum + purchase.balance, 0);
}
await db.update('suppliers', suppliers.map((supplier) => ({ id: supplier.id, record: supplier })));

const stockSold = new Map<string, number>();
const soldDevices: { productId: string; device: { id: string; serial: string; imei1: string } }[] = [];
const saleRows: {
  day: number;
  customer: number;
  product: number;
  qty: number;
  method: 'cash' | 'mpesa' | 'card' | 'bank_transfer';
}[] = [
  { day: 0, customer: 0, product: 0, qty: 1, method: 'mpesa' },
  { day: 0, customer: 1, product: 8, qty: 2, method: 'cash' },
  { day: 1, customer: 2, product: 6, qty: 1, method: 'card' },
  { day: 2, customer: 3, product: 9, qty: 3, method: 'cash' },
  { day: 3, customer: 4, product: 1, qty: 1, method: 'mpesa' },
  { day: 4, customer: 5, product: 11, qty: 2, method: 'bank_transfer' },
  { day: 5, customer: 6, product: 10, qty: 1, method: 'cash' },
  { day: 6, customer: 7, product: 7, qty: 1, method: 'card' },
  { day: 7, customer: 8, product: 2, qty: 1, method: 'mpesa' },
  { day: 8, customer: 9, product: 12, qty: 2, method: 'cash' },
  { day: 10, customer: 10, product: 6, qty: 2, method: 'cash' },
  { day: 11, customer: 11, product: 8, qty: 1, method: 'mpesa' },
  { day: 13, customer: 0, product: 5, qty: 1, method: 'card' },
  { day: 15, customer: 2, product: 9, qty: 4, method: 'cash' },
  { day: 17, customer: 4, product: 3, qty: 1, method: 'mpesa' },
  { day: 19, customer: 6, product: 11, qty: 1, method: 'cash' },
  { day: 21, customer: 8, product: 10, qty: 1, method: 'bank_transfer' },
  { day: 24, customer: 10, product: 4, qty: 1, method: 'card' },
  { day: 27, customer: 1, product: 6, qty: 1, method: 'cash' },
  { day: 30, customer: 3, product: 0, qty: 1, method: 'mpesa' },
];
const sales: Record<string, any>[] = [];
const payments: Record<string, any>[] = [];
const mpesaTransactions: Record<string, any>[] = [];
const warranties: Record<string, any>[] = [];
const warrantyMonthsByProduct = new Map(products.map((product) => [product.id, product.warrantyMonths]));

for (let index = 0; index < saleRows.length; index += 1) {
  const row = saleRows[index];
  const product = products[row.product];
  const serialProduct = product.requiresSerial;
  const device = serialProduct
    ? devicesByProduct.get(product.id)?.find((unit) => !soldDevices.some((sold) => sold.device.id === unit.id))
    : undefined;
  if (serialProduct && !device) throw new Error(`No demo device unit available for ${product.name}.`);
  const staffMember = staff[2 + (index % 3)];
  const total = product.sellingPrice * row.qty;
  const saleId = makeId();
  const invoiceNumber = `DEMO-INV-${String(index + 1).padStart(5, '0')}`;
  const transactionId = row.method === 'mpesa' ? makeId() : '';
  const saleDate = daysAgo(row.day);
  const sale = {
    id: saleId,
    invoiceNumber,
    customerId: customers[row.customer].id,
    customerName: customers[row.customer].fullName,
    staffId: staffMember.id,
    staffName: staffMember.fullName,
    items: [{
      productId: product.id,
      productName: product.name,
      qty: row.qty,
      unitPrice: product.sellingPrice,
      discount: 0,
      total,
      ...(device ? { deviceUnitId: device.id, serial: device.serial, imei1: device.imei1 } : {}),
    }],
    subtotal: total,
    discountTotal: 0,
    tax: 0,
    total,
    paymentMethod: row.method,
    paymentStatus: 'paid',
    mpesaTransactionId: transactionId,
    status: 'completed',
    date: saleDate,
  };
  sales.push(sale);
  payments.push({
    id: makeId(), saleId, method: row.method, amount: total,
    reference: row.method === 'mpesa' ? `DEMO-MPESA-${String(index + 1).padStart(4, '0')}` : `DEMO-${row.method.toUpperCase()}-${String(index + 1).padStart(4, '0')}`,
    status: 'successful', date: saleDate,
  });
  if (row.method === 'mpesa') {
    mpesaTransactions.push({
      id: transactionId, saleId, phone: customers[row.customer].phone, amount: total,
      merchantRequestId: `DEMO-MERCHANT-${String(index + 1).padStart(4, '0')}`,
      checkoutRequestId: `DEMO-CHECKOUT-${String(index + 1).padStart(4, '0')}`,
      resultCode: '0',
      resultDesc: 'Synthetic demo transaction; no payment was initiated or received.',
      status: 'successful', createdAt: saleDate, updatedAt: saleDate,
    });
  }
  customers[row.customer].totalSpent += total;
  stockSold.set(product.id, (stockSold.get(product.id) || 0) + row.qty);
  if (device) {
    soldDevices.push({ productId: product.id, device });
    const deviceRecord = (devicesByProduct.get(product.id) || []).find((unit) => unit.id === device.id);
    if (deviceRecord) await db.update('deviceUnits', [{ id: device.id, record: { ...deviceRecord, status: 'sold', saleId } }]);
    warranties.push({
      id: makeId(), saleId, invoiceNumber, productId: product.id, productName: product.name,
      customerId: customers[row.customer].id, customerName: customers[row.customer].fullName,
      serial: device.serial, imei1: device.imei1, warrantyMonths: warrantyMonthsByProduct.get(product.id) || 12,
      startDate: saleDate, expiryDate: new Date(new Date(saleDate).setMonth(new Date(saleDate).getMonth() + (warrantyMonthsByProduct.get(product.id) || 12))).toISOString(),
    });
  }
}

await db.add('sales', sales);
await db.add('payments', payments);
await db.add('mpesaTransactions', mpesaTransactions);
await db.add('warranties', warranties);
await db.update('customers', customers.map((customer) => ({ id: customer.id, record: customer })));

const salesByProduct = new Map<string, number>();
for (const sale of sales) {
  for (const item of sale.items) salesByProduct.set(item.productId, (salesByProduct.get(item.productId) || 0) + item.qty);
}
const purchasedByProduct = new Map<string, number>();
for (const purchase of purchases) {
  for (const item of purchase.items) purchasedByProduct.set(item.productId, (purchasedByProduct.get(item.productId) || 0) + item.qty);
}
for (const product of products) {
  const finalStock = product.stock + (purchasedByProduct.get(product.id) || 0) - (salesByProduct.get(product.id) || 0);
  const status = finalStock <= 0 ? 'out_of_stock' : finalStock <= product.minStock ? 'low_stock' : 'in_stock';
  await db.update('products', [{ id: product.id, record: { ...product, stock: finalStock, status } }]);
}

const repairStatuses = ['received', 'diagnosing', 'awaiting_parts', 'repairing', 'ready_for_collection'];
const repairs = Array.from({ length: 5 }, (_, index) => ({
  id: makeId(),
  jobCardNumber: `DEMO-JOB-${String(index + 1).padStart(4, '0')}`,
  customerId: customers[index].id,
  customerName: customers[index].fullName,
  customerPhone: customers[index].phone,
  deviceType: index % 2 ? 'Laptop' : 'Smartphone',
  brand: ['Samsung', 'Apple', 'HP', 'Tecno', 'Lenovo'][index],
  model: ['Galaxy A54', 'iPhone 13', 'EliteBook 840', 'Spark 10', 'IdeaPad 3'][index],
  serialOrImei: `DEMO-REPAIR-${String(index + 1).padStart(4, '0')}`,
  problemDescription: ['Battery replacement', 'Charging port inspection', 'Screen diagnostic', 'Software troubleshooting', 'Keyboard replacement'][index],
  technicianId: staff[3].id,
  technicianName: staff[3].fullName,
  estimatedCost: [4500, 3500, 6500, 2500, 5200][index],
  finalCost: 0,
  deposit: index === 4 ? 1500 : 0,
  balance: [4500, 3500, 6500, 2500, 3700][index],
  status: repairStatuses[index],
  dateReceived: daysAgo(index + 1),
  expectedDate: daysAgo(index - 3),
  dateCompleted: '',
}));
await db.add('repairs', repairs);

const expenses = [
  ['Rent', 'Demo monthly shop rent', 45000, 25],
  ['Electricity', 'Demo utility bill', 6200, 20],
  ['Internet', 'Demo business internet', 3500, 16],
  ['Transport', 'Demo stock delivery', 1800, 12],
  ['Marketing', 'Demo social media promotion', 5000, 9],
  ['Supplies', 'Demo packaging and receipt rolls', 2400, 5],
  ['Salaries', 'Demo staff payroll sample', 32000, 2],
  ['Miscellaneous', 'Demo shop supplies', 900, 0],
].map(([category, description, amount, day], index) => ({
  id: makeId(), category, description, amount, paymentMethod: index % 2 ? 'mpesa' : 'cash',
  date: daysAgo(Number(day)), staffId: staff[4].id, staffName: staff[4].fullName,
  reference: `DEMO-EXP-${String(index + 1).padStart(4, '0')}`,
  notes: 'Synthetic sample record; not a real business expense.',
}));
await db.add('expenses', expenses);

const settings = {
  id: makeId(),
  businessName: 'STAR ELECTRONICS — DEMO',
  tagline: 'Showcase environment · Synthetic data only',
  phone: '0000000000',
  email: 'demo@example.invalid',
  location: 'Nairobi, Kenya (demo)',
  currency: 'KES',
  taxRate: 16,
  invoicePrefix: 'DEMO-INV-',
  invoiceCounter: sales.length + 1,
  jobCardCounter: repairs.length + 1,
  receiptFooter: 'DEMO RECORD — Sample data only. No real transaction.',
  warrantyDefaultMonths: 12,
  mpesaShortcode: '',
  negativeInventoryAllowed: false,
  cashierDiscountCapPercent: 5,
};
await db.add('settings', [settings]);
await db.add('cashRegisters', [{
  id: makeId(), date: now.toISOString().slice(0, 10), openingBalance: 25000,
  openedBy: staff[0].fullName, createdAt: now.toISOString(),
}]);
await db.add('notifications', [
  { id: makeId(), type: 'low_stock', message: 'Tecno Camon 30 (Demo) is low on stock (sample inventory alert).', read: false, date: now.toISOString(), relatedId: products[3].id },
  { id: makeId(), type: 'repair_ready', message: 'Demo repair job DEMO-JOB-0005 is ready for collection.', read: false, date: now.toISOString(), relatedId: repairs[4].id },
  { id: makeId(), type: 'demo_info', message: 'This workspace contains synthetic demonstration data only.', read: true, date: now.toISOString(), relatedId: '' },
]);
await db.add('auditLogs', [
  { id: makeId(), staffId: ownerId, staffName: staff[0].fullName, action: 'demo_seeded', details: 'Created synthetic demonstration dataset.', date: now.toISOString() },
  { id: makeId(), staffId: staff[1].id, staffName: staff[1].fullName, action: 'stock_received', details: 'Received sample stock from demo suppliers.', date: daysAgo(15) },
]);
await db.add('meta', [
  { id: makeId(), key: 'demoDataPurged', value: true, purgedAt: now.toISOString() },
  { id: makeId(), key: 'demoDataset', value: true, seededAt: now.toISOString(), version: 1 },
]);

console.log(`Demo seed complete: ${products.length} products, ${customers.length} customers, ${sales.length} sales, ${repairs.length} repairs.`);
console.log('Demo logins: admin / 2114, manager / 2468, sales.demo / 1357, tech.demo / 9753, accounts.demo / 8642.');
