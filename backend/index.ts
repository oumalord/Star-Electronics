import { router, json, error } from './lib/runtime';
import type { RouterContext } from './lib/runtime';
import { db } from './lib/neon';
import { genToken, hashPin, newSalt, getStaffByToken, extractToken, can, sanitizeStaff, getSettings, nextInvoiceNumber, nextJobCardNumber, logAudit, notify } from './lib/helpers';
import { initiateStkPush, resolveIfDue } from './lib/mpesa';
import { ensureSeeded, ensureOwnerAccount, purgeDemoDataOnce } from './lib/seed';
import type { Staff, Product, Sale, SaleItem, Customer, Supplier, DeviceUnit, MpesaTransaction, Repair, Warranty, CashRegister } from './lib/types';

async function authGuard(ctx: RouterContext, allowed: string[] | null): Promise<{ staff: Staff | null; resp: ReturnType<typeof error> | null }> {
  const token = extractToken(ctx);
  const staff = await getStaffByToken(token);
  if (!staff) return { staff: null, resp: error('Session expired. Please log in again.', 401) };
  if (allowed && !allowed.some((a) => can(staff, a))) return { staff: null, resp: error('You do not have permission to perform this action.', 403) };
  return { staff, resp: null };
}

function productStatus(stock: number, minStock: number, discontinued: boolean): Product['status'] {
  if (discontinued) return 'discontinued';
  if (stock <= 0) return 'out_of_stock';
  if (stock <= minStock) return 'low_stock';
  return 'in_stock';
}

async function finalizeSale(saleId: string): Promise<void> {
  const [sale] = await db.get<Sale>('sales', [saleId]);
  if (!sale || sale.paymentStatus === 'paid') return;
  const settings = await getSettings();

  for (const item of sale.items) {
    const [product] = await db.get<Product>('products', [item.productId]);
    if (product) {
      const newStock = product.stock - item.qty;
      await db.update('products', [{ id: product.id, record: { ...product, stock: newStock, status: productStatus(newStock, product.minStock, product.status === 'discontinued') } }]);
      if (newStock <= product.minStock) {
        await notify('low_stock', `${product.name} is ${newStock <= 0 ? 'out of stock' : 'low on stock'} (${newStock} left)`, product.id);
      }
      if (product.requiresSerial || product.requiresImei) {
        const warrantyMonths = product.warrantyMonths || settings.warrantyDefaultMonths;
        const start = new Date();
        const expiry = new Date(start);
        expiry.setMonth(expiry.getMonth() + warrantyMonths);
        await db.add('warranties', [{
          saleId: sale.id, invoiceNumber: sale.invoiceNumber, productId: product.id, productName: product.name,
          customerId: sale.customerId, customerName: sale.customerName,
          serial: item.serial || '', imei1: item.imei1 || '',
          warrantyMonths, startDate: start.toISOString(), expiryDate: expiry.toISOString(),
        }]);
      }
      if (item.deviceUnitId) {
        const [du] = await db.get<DeviceUnit>('deviceUnits', [item.deviceUnitId]);
        if (du) await db.update('deviceUnits', [{ id: du.id, record: { ...du, status: 'sold', saleId: sale.id } }]);
      }
    }
  }

  if (sale.customerId) {
    const [customer] = await db.get<Customer>('customers', [sale.customerId]);
    if (customer) await db.update('customers', [{ id: customer.id, record: { ...customer, totalSpent: customer.totalSpent + sale.total } }]);
  }

  await db.add('payments', [{ saleId: sale.id, method: sale.paymentMethod, amount: sale.total, reference: sale.mpesaTransactionId || '', status: 'successful', date: new Date().toISOString() }]);
  await db.update('sales', [{ id: sale.id, record: { ...sale, paymentStatus: 'paid' } }]);
  await logAudit(null, 'sale_completed', `Sale ${sale.invoiceNumber} completed - ${settings.currency} ${sale.total}`);
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'POST /api/auth/bootstrap': [async () => { await ensureSeeded(); return json({ ok: true }); }],

  'POST /api/auth/login': [async (ctx) => {
    await ensureSeeded();
    try {
      await ensureOwnerAccount();
    } catch (e) {
      console.error('ensureOwnerAccount failed', e);
    }
    try {
      await purgeDemoDataOnce();
    } catch (e) {
      console.error('purgeDemoDataOnce failed', e);
    }
    const b = ctx.body as { username?: string; pin?: string };
    if (!b.username || !b.pin) return error('Username and PIN are required.', 400);
    const { items } = await db.list<Staff>('staff', { filter: { username: b.username.toLowerCase().trim() }, limit: 1 });
    const staff = items[0];
    if (!staff || staff.status !== 'active') return error('Invalid username or PIN.', 401);
    const computed = hashPin(b.pin, staff.pinSalt);
    if (computed !== staff.pinHash) return error('Invalid username or PIN.', 401);
    const token = genToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await db.add('sessions', [{ staffId: staff.id, token, createdAt: new Date().toISOString(), expiresAt }]);
    await logAudit(staff, 'login', `${staff.fullName} logged in`);
    return json({ token, staff: sanitizeStaff(staff) });
  }],

  'POST /api/auth/logout': [async (ctx) => {
    const token = extractToken(ctx);
    if (token) {
      const { items } = await db.list('sessions', { filter: { token }, limit: 1 });
      if (items[0]) await db.delete('sessions', [items[0].id!]);
    }
    return json({ ok: true });
  }],

  'GET /api/auth/me': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    return json({ staff: sanitizeStaff(auth.staff) });
  }],

  'GET /api/staff': [async (ctx) => {
    const auth = await authGuard(ctx, ['staff_view', 'staff_manage']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Staff>('staff', { limit: 100 });
    return json({ staff: items.map(sanitizeStaff) });
  }],
  'POST /api/staff': [async (ctx) => {
    const auth = await authGuard(ctx, ['staff_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.fullName || !b.username || !b.pin || !b.role) return error('Full name, username, PIN and role are required.', 400);
    const { items: existing } = await db.list('staff', { filter: { username: String(b.username).toLowerCase().trim() }, limit: 1 });
    if (existing[0]) return error('That username is already taken.', 400);
    const salt = newSalt();
    const pinHash = hashPin(String(b.pin), salt);
    const [id] = await db.add('staff', [{ fullName: b.fullName, username: String(b.username).toLowerCase().trim(), pinHash, pinSalt: salt, role: b.role, phone: b.phone || '', email: b.email || '', status: 'active', commissionPercent: Number(b.commissionPercent) || 0, dateJoined: new Date().toISOString() }]);
    await logAudit(auth.staff, 'staff_added', `Added staff member ${b.fullName} (${b.role})`);
    return json({ id });
  }],
  'PUT /api/staff/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['staff_manage']);
    if (!auth.staff) return auth.resp!;
    const [existing] = await db.get<Staff>('staff', [ctx.params.id]);
    if (!existing) return error('Staff member not found.', 404);
    const b = ctx.body as Record<string, any>;
    const record: Staff = { ...existing, fullName: b.fullName ?? existing.fullName, role: b.role ?? existing.role, phone: b.phone ?? existing.phone, email: b.email ?? existing.email, status: b.status ?? existing.status, commissionPercent: b.commissionPercent !== undefined ? Number(b.commissionPercent) : existing.commissionPercent };
    if (b.pin) {
      const salt = newSalt();
      record.pinHash = hashPin(String(b.pin), salt);
      record.pinSalt = salt;
    }
    await db.update('staff', [{ id: ctx.params.id, record }]);
    await logAudit(auth.staff, 'staff_updated', `Updated staff member ${record.fullName}`);
    return json({ ok: true });
  }],
  'DELETE /api/staff/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['staff_manage']);
    if (!auth.staff) return auth.resp!;
    await db.delete('staff', [ctx.params.id]);
    await logAudit(auth.staff, 'staff_removed', `Removed staff member ${ctx.params.id}`);
    return json({ ok: true });
  }],

  'GET /api/categories': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list('categories', { limit: 100 });
    return json({ categories: items });
  }],
  'POST /api/categories': [async (ctx) => {
    const auth = await authGuard(ctx, ['products_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.name) return error('Category name is required.', 400);
    const [id] = await db.add('categories', [{ name: b.name }]);
    return json({ id });
  }],
  'DELETE /api/categories/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['products_manage']);
    if (!auth.staff) return auth.resp!;
    await db.delete('categories', [ctx.params.id]);
    return json({ ok: true });
  }],

  'GET /api/products': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Product>('products', { limit: 500 });
    return json({ products: items });
  }],
  'POST /api/products': [async (ctx) => {
    const auth = await authGuard(ctx, ['products_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.name || !b.sku || b.sellingPrice === undefined) return error('Name, SKU and selling price are required.', 400);
    const stock = Number(b.stock) || 0;
    const minStock = Number(b.minStock) || 5;
    const [id] = await db.add('products', [{
      name: b.name, sku: b.sku, barcode: b.barcode || '', categoryId: b.categoryId || '', brand: b.brand || '', model: b.model || '',
      description: b.description || '', purchasePrice: Number(b.purchasePrice) || 0, sellingPrice: Number(b.sellingPrice),
      wholesalePrice: Number(b.wholesalePrice) || Number(b.sellingPrice), discountPrice: Number(b.discountPrice) || Number(b.sellingPrice),
      stock, minStock, supplierId: b.supplierId || '', warrantyMonths: Number(b.warrantyMonths) || 0,
      requiresSerial: !!b.requiresSerial, requiresImei: !!b.requiresImei, status: productStatus(stock, minStock, false),
      icon: b.icon || '\uD83D\uDCE6', createdAt: new Date().toISOString(),
    }]);
    await logAudit(auth.staff, 'product_added', `Added product ${b.name}`);
    return json({ id });
  }],
  'PUT /api/products/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['products_manage']);
    if (!auth.staff) return auth.resp!;
    const [existing] = await db.get<Product>('products', [ctx.params.id]);
    if (!existing) return error('Product not found.', 404);
    const b = ctx.body as Record<string, any>;
    const stock = b.stock !== undefined ? Number(b.stock) : existing.stock;
    const minStock = b.minStock !== undefined ? Number(b.minStock) : existing.minStock;
    const discontinued = b.status === 'discontinued';
    const record: Product = {
      ...existing, name: b.name ?? existing.name, sku: b.sku ?? existing.sku, barcode: b.barcode ?? existing.barcode,
      categoryId: b.categoryId ?? existing.categoryId, brand: b.brand ?? existing.brand, model: b.model ?? existing.model,
      description: b.description ?? existing.description,
      purchasePrice: b.purchasePrice !== undefined ? Number(b.purchasePrice) : existing.purchasePrice,
      sellingPrice: b.sellingPrice !== undefined ? Number(b.sellingPrice) : existing.sellingPrice,
      wholesalePrice: b.wholesalePrice !== undefined ? Number(b.wholesalePrice) : existing.wholesalePrice,
      discountPrice: b.discountPrice !== undefined ? Number(b.discountPrice) : existing.discountPrice,
      stock, minStock, supplierId: b.supplierId ?? existing.supplierId,
      warrantyMonths: b.warrantyMonths !== undefined ? Number(b.warrantyMonths) : existing.warrantyMonths,
      requiresSerial: b.requiresSerial !== undefined ? !!b.requiresSerial : existing.requiresSerial,
      requiresImei: b.requiresImei !== undefined ? !!b.requiresImei : existing.requiresImei,
      status: productStatus(stock, minStock, discontinued), icon: b.icon ?? existing.icon,
    };
    await db.update('products', [{ id: ctx.params.id, record }]);
    await logAudit(auth.staff, 'product_updated', `Updated product ${record.name}`);
    return json({ ok: true });
  }],
  'DELETE /api/products/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['products_manage']);
    if (!auth.staff) return auth.resp!;
    await db.delete('products', [ctx.params.id]);
    await logAudit(auth.staff, 'product_deleted', `Deleted product ${ctx.params.id}`);
    return json({ ok: true });
  }],
  'POST /api/products/:id/adjust-stock': [async (ctx) => {
    const auth = await authGuard(ctx, ['stock_adjust']);
    if (!auth.staff) return auth.resp!;
    const [existing] = await db.get<Product>('products', [ctx.params.id]);
    if (!existing) return error('Product not found.', 404);
    const b = ctx.body as Record<string, any>;
    const delta = Number(b.delta) || 0;
    const newStock = Math.max(0, existing.stock + delta);
    await db.update('products', [{ id: existing.id, record: { ...existing, stock: newStock, status: productStatus(newStock, existing.minStock, existing.status === 'discontinued') } }]);
    await logAudit(auth.staff, 'stock_adjusted', `${existing.name}: ${delta > 0 ? '+' : ''}${delta} (${b.reason || 'manual adjustment'})`);
    return json({ ok: true, newStock });
  }],

  'GET /api/devices': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const filter: Record<string, string> = {};
    if (ctx.query.productId) filter.productId = ctx.query.productId;
    if (ctx.query.status) filter.status = ctx.query.status;
    const { items } = await db.list<DeviceUnit>('deviceUnits', { filter, limit: 500 });
    return json({ devices: items });
  }],
  'POST /api/devices': [async (ctx) => {
    const auth = await authGuard(ctx, ['products_manage', 'purchases_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.productId) return error('Product is required.', 400);
    const [id] = await db.add('deviceUnits', [{ productId: b.productId, serial: b.serial || '', imei1: b.imei1 || '', imei2: b.imei2 || '', color: b.color || '', storage: b.storage || '', ram: b.ram || '', status: 'in_stock', saleId: '', createdAt: new Date().toISOString() }]);
    return json({ id });
  }],
  'GET /api/devices/search': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const q = (ctx.query.q || '').toLowerCase().trim();
    if (!q) return json({ results: [] });
    const { items } = await db.list<DeviceUnit>('deviceUnits', { limit: 500 });
    const results = items.filter((d) => d.serial.toLowerCase().includes(q) || d.imei1.toLowerCase().includes(q) || d.imei2.toLowerCase().includes(q));
    return json({ results });
  }],

  'GET /api/suppliers': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Supplier>('suppliers', { limit: 200 });
    return json({ suppliers: items });
  }],
  'POST /api/suppliers': [async (ctx) => {
    const auth = await authGuard(ctx, ['suppliers_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.name) return error('Supplier name is required.', 400);
    const [id] = await db.add('suppliers', [{ name: b.name, company: b.company || b.name, phone: b.phone || '', email: b.email || '', location: b.location || '', address: b.address || '', amountOwed: 0, createdAt: new Date().toISOString() }]);
    return json({ id });
  }],
  'PUT /api/suppliers/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['suppliers_manage']);
    if (!auth.staff) return auth.resp!;
    const [existing] = await db.get<Supplier>('suppliers', [ctx.params.id]);
    if (!existing) return error('Supplier not found.', 404);
    const b = ctx.body as Record<string, any>;
    await db.update('suppliers', [{ id: ctx.params.id, record: { ...existing, name: b.name ?? existing.name, company: b.company ?? existing.company, phone: b.phone ?? existing.phone, email: b.email ?? existing.email, location: b.location ?? existing.location, address: b.address ?? existing.address } }]);
    return json({ ok: true });
  }],
  'DELETE /api/suppliers/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['suppliers_manage']);
    if (!auth.staff) return auth.resp!;
    await db.delete('suppliers', [ctx.params.id]);
    return json({ ok: true });
  }],

  'GET /api/purchases': [async (ctx) => {
    const auth = await authGuard(ctx, ['purchases_manage', 'reports_view']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list('purchases', { limit: 300 });
    return json({ purchases: items });
  }],
  'POST /api/purchases': [async (ctx) => {
    const auth = await authGuard(ctx, ['purchases_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.supplierId || !Array.isArray(b.items) || b.items.length === 0) return error('Supplier and at least one item are required.', 400);
    let totalCost = 0;
    const purchaseItems: { productId: string; productName: string; qty: number; purchasePrice: number }[] = [];
    for (const it of b.items) {
      const [product] = await db.get<Product>('products', [it.productId]);
      if (!product) continue;
      const qty = Number(it.qty) || 0;
      const purchasePrice = Number(it.purchasePrice) || product.purchasePrice;
      totalCost += qty * purchasePrice;
      purchaseItems.push({ productId: product.id, productName: product.name, qty, purchasePrice });
      const newStock = product.stock + qty;
      await db.update('products', [{ id: product.id, record: { ...product, stock: newStock, purchasePrice, status: productStatus(newStock, product.minStock, false) } }]);
      if (Array.isArray(it.serials)) {
        for (const s of it.serials) {
          await db.add('deviceUnits', [{ productId: product.id, serial: s.serial || '', imei1: s.imei1 || '', imei2: s.imei2 || '', color: s.color || '', storage: s.storage || '', ram: s.ram || '', status: 'in_stock', saleId: '', createdAt: new Date().toISOString() }]);
        }
      }
    }
    const amountPaid = Number(b.amountPaid) || 0;
    const balance = Math.max(0, totalCost - amountPaid);
    const [id] = await db.add('purchases', [{ supplierId: b.supplierId, items: purchaseItems, totalCost, amountPaid, balance, status: balance > 0 ? 'partial' : 'received', date: new Date().toISOString(), receivedBy: auth.staff.fullName }]);
    const [supplier] = await db.get<Supplier>('suppliers', [b.supplierId]);
    if (supplier) await db.update('suppliers', [{ id: supplier.id, record: { ...supplier, amountOwed: supplier.amountOwed + balance } }]);
    await logAudit(auth.staff, 'stock_received', `Received stock from supplier - ${purchaseItems.length} product line(s), total KES ${totalCost}`);
    return json({ id });
  }],
  'POST /api/purchases/:id/pay': [async (ctx) => {
    const auth = await authGuard(ctx, ['purchases_manage']);
    if (!auth.staff) return auth.resp!;
    const [purchase] = await db.get<{ id: string; supplierId: string; totalCost: number; amountPaid: number; balance: number; status: string }>('purchases', [ctx.params.id]);
    if (!purchase) return error('Purchase not found.', 404);
    const b = ctx.body as Record<string, any>;
    const amount = Number(b.amount) || 0;
    const newPaid = purchase.amountPaid + amount;
    const newBalance = Math.max(0, purchase.totalCost - newPaid);
    await db.update('purchases', [{ id: purchase.id, record: { ...purchase, amountPaid: newPaid, balance: newBalance, status: newBalance > 0 ? 'partial' : 'received' } }]);
    const [supplier] = await db.get<Supplier>('suppliers', [purchase.supplierId]);
    if (supplier) await db.update('suppliers', [{ id: supplier.id, record: { ...supplier, amountOwed: Math.max(0, supplier.amountOwed - amount) } }]);
    await logAudit(auth.staff, 'supplier_payment', `Paid KES ${amount} to supplier for purchase ${purchase.id}`);
    return json({ ok: true });
  }],

  'GET /api/customers': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Customer>('customers', { limit: 500 });
    return json({ customers: items });
  }],
  'POST /api/customers': [async (ctx) => {
    const auth = await authGuard(ctx, ['customers_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.fullName || !b.phone) return error('Full name and phone are required.', 400);
    const [id] = await db.add('customers', [{ fullName: b.fullName, phone: b.phone, email: b.email || '', address: b.address || '', customerType: b.customerType || 'walk_in', totalSpent: 0, outstandingBalance: 0, createdAt: new Date().toISOString() }]);
    return json({ id });
  }],
  'PUT /api/customers/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['customers_manage']);
    if (!auth.staff) return auth.resp!;
    const [existing] = await db.get<Customer>('customers', [ctx.params.id]);
    if (!existing) return error('Customer not found.', 404);
    const b = ctx.body as Record<string, any>;
    await db.update('customers', [{ id: ctx.params.id, record: { ...existing, fullName: b.fullName ?? existing.fullName, phone: b.phone ?? existing.phone, email: b.email ?? existing.email, address: b.address ?? existing.address, customerType: b.customerType ?? existing.customerType } }]);
    return json({ ok: true });
  }],
  'DELETE /api/customers/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['customers_manage']);
    if (!auth.staff) return auth.resp!;
    await db.delete('customers', [ctx.params.id]);
    return json({ ok: true });
  }],
  'GET /api/customers/:id/history': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Sale>('sales', { filter: { customerId: ctx.params.id }, limit: 200 });
    const { items: warranties } = await db.list<Warranty>('warranties', { filter: { customerId: ctx.params.id }, limit: 100 });
    return json({ sales: items, warranties });
  }],

  'POST /api/sales': [async (ctx) => {
    const auth = await authGuard(ctx, ['pos']);
    if (!auth.staff) return auth.resp!;
    const staff = auth.staff;
    const b = ctx.body as Record<string, any>;
    if (!Array.isArray(b.items) || b.items.length === 0) return error('Add at least one item to the cart.', 400);
    const settings = await getSettings();

    let subtotal = 0;
    let itemDiscounts = 0;
    const saleItems: SaleItem[] = [];
    for (const it of b.items) {
      const [product] = await db.get<Product>('products', [it.productId]);
      if (!product) return error(`Product not found: ${it.productId}`, 400);
      const qty = Number(it.qty) || 1;
      if (!settings.negativeInventoryAllowed && product.stock < qty) return error(`Insufficient stock for ${product.name}. Only ${product.stock} left.`, 400);
      if ((product.requiresSerial || product.requiresImei) && !it.deviceUnitId) return error(`${product.name} requires selecting a specific serial/IMEI unit.`, 400);
      let serial = '';
      let imei1 = '';
      if (it.deviceUnitId) {
        const [du] = await db.get<DeviceUnit>('deviceUnits', [it.deviceUnitId]);
        if (!du || du.status !== 'in_stock') return error(`Selected unit for ${product.name} is not available.`, 400);
        serial = du.serial;
        imei1 = du.imei1;
      }
      const unitPrice = Number(it.unitPrice) || product.sellingPrice;
      const discount = Number(it.discount) || 0;
      const lineTotal = qty * unitPrice - discount;
      subtotal += qty * unitPrice;
      itemDiscounts += discount;
      saleItems.push({ productId: product.id, productName: product.name, qty, unitPrice, discount, total: lineTotal, deviceUnitId: it.deviceUnitId || undefined, serial, imei1 });
    }
    const overallDiscount = Number(b.discountTotal) || 0;
    const totalDiscount = itemDiscounts + overallDiscount;
    const discountPercent = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;
    if (!can(staff, 'discounts_unlimited') && discountPercent > settings.cashierDiscountCapPercent) {
      return error(`Discount of ${discountPercent.toFixed(1)}% exceeds your limit of ${settings.cashierDiscountCapPercent}%. Ask a manager to authorize.`, 403);
    }
    const total = Math.max(0, subtotal - totalDiscount);

    let customerName = 'Walk-in Customer';
    if (b.customerId) {
      const [customer] = await db.get<Customer>('customers', [b.customerId]);
      if (customer) customerName = customer.fullName;
    }

    const invoiceNumber = await nextInvoiceNumber();
    const paymentMethod = b.paymentMethod || 'cash';
    const isMpesa = paymentMethod === 'mpesa';

    const saleRecord = {
      invoiceNumber, customerId: b.customerId || '', customerName, staffId: staff.id, staffName: staff.fullName,
      items: saleItems, subtotal, discountTotal: totalDiscount, tax: 0, total,
      paymentMethod, paymentStatus: isMpesa ? 'pending' : 'paid', mpesaTransactionId: '',
      status: 'completed', date: new Date().toISOString(),
    };
    const [saleId] = await db.add('sales', [saleRecord]);

    if (!isMpesa) await finalizeSale(saleId as string);

    let mpesaTxn = null;
    if (isMpesa) {
      if (!b.mpesaPhone) return error('M-Pesa phone number is required.', 400);
      mpesaTxn = await initiateStkPush(b.mpesaPhone, total, saleId as string, invoiceNumber);
      await db.update('sales', [{ id: saleId as string, record: { ...saleRecord, mpesaTransactionId: mpesaTxn.id } }]);
    }

    const [finalSale] = await db.get<Sale>('sales', [saleId as string]);
    return json({ sale: finalSale, mpesaTransaction: mpesaTxn });
  }],
  'GET /api/sales': [async (ctx) => {
    const auth = await authGuard(ctx, ['sales_view', 'pos']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Sale>('sales', { limit: 500 });
    return json({ sales: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
  }],
  'GET /api/sales/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['sales_view', 'pos']);
    if (!auth.staff) return auth.resp!;
    const [sale] = await db.get<Sale>('sales', [ctx.params.id]);
    if (!sale) return error('Sale not found.', 404);
    return json({ sale });
  }],
  'POST /api/sales/:id/refund': [async (ctx) => {
    const auth = await authGuard(ctx, ['refunds_authorize']);
    if (!auth.staff) return auth.resp!;
    const [sale] = await db.get<Sale>('sales', [ctx.params.id]);
    if (!sale) return error('Sale not found.', 404);
    const b = ctx.body as Record<string, any>;
    const refundItems: { productId: string; productName: string; qty: number; amount: number }[] = [];
    let refundAmount = 0;
    for (const it of b.items || []) {
      const saleItem = sale.items[it.saleItemIndex];
      if (!saleItem) continue;
      const qty = Math.min(Number(it.qty) || saleItem.qty, saleItem.qty);
      const amount = (saleItem.total / saleItem.qty) * qty;
      refundAmount += amount;
      refundItems.push({ productId: saleItem.productId, productName: saleItem.productName, qty, amount });
      const [product] = await db.get<Product>('products', [saleItem.productId]);
      if (product) {
        const newStock = product.stock + qty;
        await db.update('products', [{ id: product.id, record: { ...product, stock: newStock, status: productStatus(newStock, product.minStock, product.status === 'discontinued') } }]);
      }
    }
    await db.add('refunds', [{ saleId: sale.id, invoiceNumber: sale.invoiceNumber, items: refundItems, reason: b.reason || '', amount: refundAmount, method: b.method || sale.paymentMethod, authorizedBy: auth.staff.fullName, date: new Date().toISOString() }]);
    const fullyRefunded = refundItems.length === sale.items.length && refundItems.every((r, i) => r.qty === sale.items[i].qty);
    await db.update('sales', [{ id: sale.id, record: { ...sale, status: fullyRefunded ? 'refunded' : 'partially_refunded' } }]);
    await logAudit(auth.staff, 'refund_processed', `Refund of KES ${refundAmount} processed for invoice ${sale.invoiceNumber}`);
    if (refundAmount > 10000) await notify('large_refund', `Large refund of KES ${refundAmount} processed for invoice ${sale.invoiceNumber}`, sale.id);
    return json({ ok: true, refundAmount });
  }],
  'POST /api/sales/:id/cancel': [async (ctx) => {
    const auth = await authGuard(ctx, ['refunds_authorize']);
    if (!auth.staff) return auth.resp!;
    const [sale] = await db.get<Sale>('sales', [ctx.params.id]);
    if (!sale) return error('Sale not found.', 404);
    if (sale.paymentStatus === 'paid') return error('Cannot cancel a completed sale - use the refund workflow instead.', 400);
    await db.update('sales', [{ id: sale.id, record: { ...sale, status: 'cancelled' } }]);
    await logAudit(auth.staff, 'sale_cancelled', `Cancelled sale ${sale.invoiceNumber}`);
    return json({ ok: true });
  }],

  'GET /api/payments': [async (ctx) => {
    const auth = await authGuard(ctx, ['sales_view', 'mpesa_view']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list('payments', { limit: 500 });
    return json({ payments: (items as any[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
  }],

  'GET /api/mpesa/status/:checkoutRequestId': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<MpesaTransaction>('mpesaTransactions', { filter: { checkoutRequestId: ctx.params.checkoutRequestId }, limit: 1 });
    let txn = items[0];
    if (!txn) return error('Transaction not found.', 404);
    txn = await resolveIfDue(txn);
    if (txn.status === 'successful') await finalizeSale(txn.saleId);
    const [sale] = txn.saleId ? await db.get<Sale>('sales', [txn.saleId]) : [null];
    return json({ transaction: txn, sale });
  }],
  'POST /api/mpesa/callback': [async (ctx) => {
    const b = ctx.body as any;
    const callback = b?.Body?.stkCallback;
    if (!callback) return error('Invalid callback payload.', 400);
    const { items } = await db.list<MpesaTransaction>('mpesaTransactions', { filter: { checkoutRequestId: callback.CheckoutRequestID }, limit: 1 });
    const txn = items[0];
    if (!txn) return error('Transaction not found.', 404);
    const success = callback.ResultCode === 0;
    await db.update('mpesaTransactions', [{ id: txn.id, record: { ...txn, status: success ? 'successful' : 'failed', resultCode: String(callback.ResultCode), resultDesc: callback.ResultDesc || '', updatedAt: new Date().toISOString() } }]);
    if (success) await finalizeSale(txn.saleId);
    return json({ ok: true });
  }],
  'GET /api/mpesa/transactions': [async (ctx) => {
    const auth = await authGuard(ctx, ['mpesa_view', 'pos']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<MpesaTransaction>('mpesaTransactions', { limit: 300 });
    return json({ transactions: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
  }],

  'GET /api/repairs': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Repair>('repairs', { limit: 300 });
    return json({ repairs: items.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime()) });
  }],
  'POST /api/repairs': [async (ctx) => {
    const auth = await authGuard(ctx, ['repairs_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.customerName || !b.deviceType) return error('Customer name and device type are required.', 400);
    const jobCardNumber = await nextJobCardNumber();
    const [id] = await db.add('repairs', [{
      jobCardNumber, customerId: b.customerId || '', customerName: b.customerName, customerPhone: b.customerPhone || '',
      deviceType: b.deviceType, brand: b.brand || '', model: b.model || '', serialOrImei: b.serialOrImei || '',
      problemDescription: b.problemDescription || '', technicianId: b.technicianId || '', technicianName: b.technicianName || '',
      estimatedCost: Number(b.estimatedCost) || 0, finalCost: 0, deposit: Number(b.deposit) || 0, balance: (Number(b.estimatedCost) || 0) - (Number(b.deposit) || 0),
      status: 'received', dateReceived: new Date().toISOString(), expectedDate: b.expectedDate || '', dateCompleted: '',
    }]);
    await logAudit(auth.staff, 'repair_logged', `Logged repair job ${jobCardNumber} for ${b.customerName}`);
    return json({ id, jobCardNumber });
  }],
  'PUT /api/repairs/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['repairs_manage']);
    if (!auth.staff) return auth.resp!;
    const [existing] = await db.get<Repair>('repairs', [ctx.params.id]);
    if (!existing) return error('Repair job not found.', 404);
    const b = ctx.body as Record<string, any>;
    const record: Repair = {
      ...existing, status: b.status ?? existing.status, finalCost: b.finalCost !== undefined ? Number(b.finalCost) : existing.finalCost,
      deposit: b.deposit !== undefined ? Number(b.deposit) : existing.deposit,
      balance: b.finalCost !== undefined ? Number(b.finalCost) - (b.deposit !== undefined ? Number(b.deposit) : existing.deposit) : existing.balance,
      technicianName: b.technicianName ?? existing.technicianName,
      dateCompleted: b.status === 'collected' || b.status === 'ready_for_collection' ? new Date().toISOString() : existing.dateCompleted,
    };
    await db.update('repairs', [{ id: ctx.params.id, record }]);
    if (b.status === 'ready_for_collection') await notify('repair_ready', `Repair job ${record.jobCardNumber} is ready for collection`, record.id);
    await logAudit(auth.staff, 'repair_updated', `Updated repair job ${record.jobCardNumber} - status: ${record.status}`);
    return json({ ok: true });
  }],

  'GET /api/warranties': [async (ctx) => {
    const auth = await authGuard(ctx, ['warranties_view', 'pos']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list<Warranty>('warranties', { limit: 500 });
    const now = Date.now();
    const withStatus = items.map((w) => {
      const expiry = new Date(w.expiryDate).getTime();
      const daysLeft = Math.ceil((expiry - now) / 86400000);
      const wstatus = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring_soon' : 'active';
      return { ...w, warrantyStatus: wstatus, daysLeft };
    });
    return json({ warranties: withStatus });
  }],

  'GET /api/expenses': [async (ctx) => {
    const auth = await authGuard(ctx, ['expenses_manage', 'reports_view']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list('expenses', { limit: 500 });
    return json({ expenses: (items as any[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
  }],
  'POST /api/expenses': [async (ctx) => {
    const auth = await authGuard(ctx, ['expenses_manage']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as Record<string, any>;
    if (!b.category || !b.amount) return error('Category and amount are required.', 400);
    const staff = auth.staff;
    const [id] = await db.add('expenses', [{ category: b.category, description: b.description || '', amount: Number(b.amount), paymentMethod: b.paymentMethod || 'cash', date: new Date().toISOString(), staffId: staff.id, staffName: staff.fullName, reference: b.reference || '', notes: b.notes || '' }]);
    await logAudit(auth.staff, 'expense_recorded', `Recorded expense: ${b.category} - KES ${b.amount}`);
    return json({ id });
  }],
  'DELETE /api/expenses/:id': [async (ctx) => {
    const auth = await authGuard(ctx, ['expenses_manage']);
    if (!auth.staff) return auth.resp!;
    await db.delete('expenses', [ctx.params.id]);
    return json({ ok: true });
  }],

  'GET /api/notifications': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list('notifications', { limit: 100 });
    return json({ notifications: (items as any[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
  }],
  'POST /api/notifications/:id/read': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const [n] = await db.get('notifications', [ctx.params.id]);
    if (n) await db.update('notifications', [{ id: ctx.params.id, record: { ...n, read: true } }]);
    return json({ ok: true });
  }],

  'GET /api/audit-logs': [async (ctx) => {
    const auth = await authGuard(ctx, ['staff_manage']);
    if (!auth.staff) return auth.resp!;
    const { items } = await db.list('auditLogs', { limit: 300 });
    return json({ logs: (items as any[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
  }],

  'GET /api/settings': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const settings = await getSettings();
    return json({ settings });
  }],
  'PUT /api/settings': [async (ctx) => {
    const auth = await authGuard(ctx, ['settings_manage']);
    if (!auth.staff) return auth.resp!;
    const settings = await getSettings();
    const b = ctx.body as Record<string, unknown>;
    const settingKeys = ['businessName', 'tagline', 'phone', 'email', 'location', 'currency', 'taxRate', 'invoicePrefix', 'invoiceCounter', 'jobCardCounter', 'receiptFooter', 'warrantyDefaultMonths', 'mpesaShortcode', 'negativeInventoryAllowed', 'cashierDiscountCapPercent'];
    const updates = Object.fromEntries(settingKeys.filter((key) => b[key] !== undefined).map((key) => [key, b[key]]));
    await db.update('settings', [{ id: settings.id, record: { ...settings, ...updates } }]);
    await logAudit(auth.staff, 'settings_updated', 'Business settings updated');
    return json({ ok: true });
  }],

  'GET /api/search': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const q = (ctx.query.q || '').toLowerCase().trim();
    if (!q || q.length < 2) return json({ products: [], customers: [], sales: [], repairs: [], suppliers: [], devices: [] });
    const [{ items: products }, { items: customers }, { items: sales }, { items: repairs }, { items: suppliers }, { items: devices }] = await Promise.all([
      db.list<Product>('products', { limit: 500 }),
      db.list<Customer>('customers', { limit: 500 }),
      db.list<Sale>('sales', { limit: 500 }),
      db.list<Repair>('repairs', { limit: 300 }),
      db.list<Supplier>('suppliers', { limit: 200 }),
      db.list<DeviceUnit>('deviceUnits', { limit: 500 }),
    ]);
    return json({
      products: products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)).slice(0, 10),
      customers: customers.filter((c) => c.fullName.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 10),
      sales: sales.filter((s) => s.invoiceNumber.toLowerCase().includes(q)).slice(0, 10),
      repairs: repairs.filter((r) => r.jobCardNumber.toLowerCase().includes(q) || r.serialOrImei.toLowerCase().includes(q)).slice(0, 10),
      suppliers: suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 10),
      devices: devices.filter((d) => d.serial.toLowerCase().includes(q) || d.imei1.toLowerCase().includes(q)).slice(0, 10),
    });
  }],

  'GET /api/dashboard': [async (ctx) => {
    const auth = await authGuard(ctx, null);
    if (!auth.staff) return auth.resp!;
    const canViewFinance = can(auth.staff, 'finance_view');
    const range = ctx.query.range || 'today';
    const now = new Date();
    let from = new Date(now);
    if (range === 'today') from.setHours(0, 0, 0, 0);
    else if (range === 'yesterday') { from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0); }
    else if (range === 'week') from.setDate(from.getDate() - 7);
    else if (range === 'month') from.setDate(from.getDate() - 30);
    else if (range === 'year') from.setFullYear(from.getFullYear() - 1);
    else if (range === 'custom' && ctx.query.from) from = new Date(ctx.query.from);
    const to = range === 'custom' && ctx.query.to ? new Date(ctx.query.to) : now;
    if (range === 'yesterday') to.setDate(to.getDate() - 1);

    const [{ items: sales }, { items: products }, { items: customers }, { items: suppliers }, { items: repairs }, { items: expenses }, { items: purchases }] = await Promise.all([
      db.list<Sale>('sales', { limit: 1000 }),
      db.list<Product>('products', { limit: 500 }),
      db.list<Customer>('customers', { limit: 500 }),
      db.list<Supplier>('suppliers', { limit: 200 }),
      db.list<Repair>('repairs', { limit: 300 }),
      db.list('expenses', { limit: 500 }),
      db.list('purchases', { limit: 500 }),
    ]);

    const inRange = sales.filter((s) => { const d = new Date(s.date); return d >= from && d <= to && s.paymentStatus === 'paid'; });
    const totalSales = inRange.reduce((sum, s) => sum + s.total, 0);
    let totalProfit = 0;
    const productMap = new Map(products.map((p) => [p.id, p]));
    const bestSellersMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    for (const s of inRange) {
      for (const it of s.items) {
        const product = productMap.get(it.productId);
        const cost = product ? product.purchasePrice * it.qty : 0;
        const profit = it.total - cost;
        totalProfit += profit;
        const existing = bestSellersMap.get(it.productId) || { name: it.productName, qty: 0, revenue: 0, profit: 0 };
        existing.qty += it.qty;
        existing.revenue += it.total;
        existing.profit += profit;
        bestSellersMap.set(it.productId, existing);
      }
    }
    const bestSellers = Array.from(bestSellersMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const mostProfitable = Array.from(bestSellersMap.values()).sort((a, b) => b.profit - a.profit).slice(0, 5);

    const byMethod: Record<string, number> = { cash: 0, mpesa: 0, card: 0, bank_transfer: 0 };
    for (const s of inRange) byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + s.total;

    const expensesInRange = (expenses as any[]).filter((e) => { const d = new Date(e.date); return d >= from && d <= to; });
    const expensesTotal = expensesInRange.reduce((sum, e) => sum + e.amount, 0);
    const todayKey = new Date().toISOString().slice(0, 10);
    const [{ items: registers }] = canViewFinance ? await Promise.all([db.list<CashRegister>('cashRegisters', { filter: { date: todayKey }, limit: 1 })]) : [{ items: [] as CashRegister[] }];
    const openingBalance = registers[0]?.openingBalance || 0;
    const cashSales = sales.filter((s) => new Date(s.date).toISOString().slice(0, 10) === todayKey && s.paymentStatus === 'paid' && s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const cashExpenses = (expenses as any[]).filter((e) => new Date(e.date).toISOString().slice(0, 10) === todayKey).reduce((sum, e) => sum + e.amount, 0);
    const purchasedByProduct = new Map<string, number>();
    for (const purchase of purchases as any[]) {
      const date = new Date(purchase.date);
      if (date < from || date > to) continue;
      for (const item of purchase.items || []) purchasedByProduct.set(item.productId, (purchasedByProduct.get(item.productId) || 0) + Number(item.qty || 0));
    }
    const soldByProduct = new Map<string, number>();
    for (const sale of inRange) for (const item of sale.items) soldByProduct.set(item.productId, (soldByProduct.get(item.productId) || 0) + item.qty);
    const closingStockUnits = products.reduce((sum, product) => sum + product.stock, 0);
    const closingStockValue = products.reduce((sum, product) => sum + product.stock * product.purchasePrice, 0);
    const openingStockUnits = products.reduce((sum, product) => sum + product.stock + (soldByProduct.get(product.id) || 0) - (purchasedByProduct.get(product.id) || 0), 0);
    const openingStockValue = products.reduce((sum, product) => sum + (product.stock + (soldByProduct.get(product.id) || 0) - (purchasedByProduct.get(product.id) || 0)) * product.purchasePrice, 0);

    const trend: { label: string; sales: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const daySales = sales.filter((s) => { const d = new Date(s.date); return d >= day && d < nextDay && s.paymentStatus === 'paid'; }).reduce((sum, s) => sum + s.total, 0);
      trend.push({ label: day.toLocaleDateString('en-KE', { weekday: 'short' }), sales: daySales });
    }

    return json({
      totalSales: canViewFinance ? totalSales : 0, totalProfit: canViewFinance ? totalProfit : 0, transactionsCount: inRange.length,
      productsSold: inRange.reduce((sum, s) => sum + s.items.reduce((q, it) => q + it.qty, 0), 0),
      byMethod: canViewFinance ? byMethod : {}, expensesTotal: canViewFinance ? expensesTotal : 0,
      financeVisible: canViewFinance,
      cashRegister: canViewFinance ? { date: todayKey, openingBalance, cashSales, cashExpenses, closingBalance: openingBalance + cashSales - cashExpenses, isOpened: !!registers[0] } : null,
      inventoryBalance: canViewFinance ? { openingStockUnits, openingStockValue, stockReceivedUnits: Array.from(purchasedByProduct.values()).reduce((sum, qty) => sum + qty, 0), stockSoldUnits: Array.from(soldByProduct.values()).reduce((sum, qty) => sum + qty, 0), closingStockUnits, closingStockValue } : null,
      lowStock: products.filter((p) => p.status === 'low_stock').length,
      outOfStock: products.filter((p) => p.status === 'out_of_stock').length,
      pendingRepairs: repairs.filter((r) => !['collected', 'cancelled'].includes(r.status)).length,
      customersCount: customers.length, suppliersCount: suppliers.length,
      outstandingSupplierBalance: suppliers.reduce((sum, s) => sum + s.amountOwed, 0),
      bestSellers, mostProfitable, trend,
      lowStockProducts: products.filter((p) => p.status === 'low_stock' || p.status === 'out_of_stock').slice(0, 8),
    });
  }],

  'POST /api/cash-register/open': [async (ctx) => {
    const auth = await authGuard(ctx, ['finance_view']);
    if (!auth.staff) return auth.resp!;
    const b = ctx.body as { date?: string; openingBalance?: number };
    const date = b.date || new Date().toISOString().slice(0, 10);
    const openingBalance = Number(b.openingBalance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) return error('A valid opening balance is required.', 400);
    const { items } = await db.list<CashRegister>('cashRegisters', { filter: { date }, limit: 1 });
    if (items[0]) await db.update('cashRegisters', [{ id: items[0].id, record: { ...items[0], openingBalance, openedBy: auth.staff.fullName } }]);
    else await db.add('cashRegisters', [{ date, openingBalance, openedBy: auth.staff.fullName, createdAt: new Date().toISOString() }]);
    return json({ ok: true });
  }],

  'GET /api/reports': [async (ctx) => {
    const auth = await authGuard(ctx, ['reports_view']);
    if (!auth.staff) return auth.resp!;
    const type = ctx.query.type || 'sales';
    const [{ items: sales }, { items: products }, { items: expenses }, { items: customers }, { items: suppliers }, { items: staff }] = await Promise.all([
      db.list<Sale>('sales', { limit: 1000 }),
      db.list<Product>('products', { limit: 500 }),
      db.list('expenses', { limit: 500 }),
      db.list<Customer>('customers', { limit: 500 }),
      db.list<Supplier>('suppliers', { limit: 200 }),
      db.list<Staff>('staff', { limit: 100 }),
    ]);
    const paidSales = sales.filter((s) => s.paymentStatus === 'paid');
    if (type === 'inventory') {
      return json({ rows: products.map((p) => ({ name: p.name, sku: p.sku, stock: p.stock, minStock: p.minStock, status: p.status, valuation: p.stock * p.purchasePrice })) });
    }
    if (type === 'staff') {
      const rows = staff.map((s) => {
        const staffSales = paidSales.filter((sale) => sale.staffId === s.id);
        const revenue = staffSales.reduce((sum, sale) => sum + sale.total, 0);
        const discounts = staffSales.reduce((sum, sale) => sum + sale.discountTotal, 0);
        return { name: s.fullName, role: s.role, salesCount: staffSales.length, revenue, discounts, commission: Math.round(revenue * (s.commissionPercent / 100)) };
      });
      return json({ rows });
    }
    if (type === 'customers') {
      const rows = customers.map((c) => ({ name: c.fullName, phone: c.phone, totalSpent: c.totalSpent, purchases: paidSales.filter((s) => s.customerId === c.id).length })).sort((a, b) => b.totalSpent - a.totalSpent);
      return json({ rows });
    }
    if (type === 'suppliers') {
      return json({ rows: suppliers.map((s) => ({ name: s.name, phone: s.phone, amountOwed: s.amountOwed })) });
    }
    if (type === 'expenses') {
      const byCategory: Record<string, number> = {};
      for (const e of expenses as any[]) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      return json({ rows: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })), total: (expenses as any[]).reduce((s, e) => s + e.amount, 0) });
    }
    if (type === 'category') {
      const catMap = new Map<string, { revenue: number; qty: number }>();
      const prodMap2 = new Map(products.map((p) => [p.id, p]));
      for (const s of paidSales) {
        for (const it of s.items) {
          const product = prodMap2.get(it.productId);
          const cat = product?.categoryId || 'unknown';
          const existing = catMap.get(cat) || { revenue: 0, qty: 0 };
          existing.revenue += it.total;
          existing.qty += it.qty;
          catMap.set(cat, existing);
        }
      }
      return json({ rows: Array.from(catMap.entries()).map(([categoryId, v]) => ({ categoryId, ...v })) });
    }
    const prodMap = new Map(products.map((p) => [p.id, p]));
    const rows = paidSales.map((s) => ({
      invoiceNumber: s.invoiceNumber, date: s.date, staffName: s.staffName, customerName: s.customerName,
      total: s.total, profit: s.items.reduce((sum, it) => { const p = prodMap.get(it.productId); return sum + (it.total - (p ? p.purchasePrice * it.qty : 0)); }, 0),
      paymentMethod: s.paymentMethod,
    }));
    return json({ rows });
  }],
});
