import { db } from './neon';
import crypto from 'node:crypto';
import type { Staff, Session, Settings } from './types';

export function genToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function newSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

export function extractToken(ctx: { query: Record<string, string>; body: unknown }): string | undefined {
  const b = ctx.body as Record<string, unknown> | null;
  return ctx.query?.token || (b && typeof b.token === 'string' ? b.token : undefined);
}

export async function getStaffByToken(token: string | undefined): Promise<Staff | null> {
  if (!token) return null;
  const { items } = await db.list<Session>('sessions', { filter: { token }, limit: 1 });
  const session = items[0];
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  const [staff] = await db.get<Staff>('staff', [session.staffId]);
  if (!staff || staff.status !== 'active') return null;
  return staff;
}

export function sanitizeStaff(s: Staff): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...s };
  delete copy.pinHash;
  delete copy.pinSalt;
  return copy;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  manager: ['pos', 'sales_view', 'products_view', 'products_manage', 'stock_adjust', 'suppliers_manage', 'purchases_manage', 'customers_manage', 'repairs_manage', 'warranties_view', 'expenses_manage', 'staff_view', 'commissions_view', 'reports_view', 'mpesa_view', 'finance_view', 'refunds_authorize', 'discounts_unlimited', 'notifications_view'],
  sales: ['pos', 'sales_view', 'products_view', 'customers_manage', 'warranties_view', 'notifications_view'],
  inventory: ['products_view', 'products_manage', 'stock_adjust', 'suppliers_manage', 'purchases_manage', 'reports_view', 'notifications_view'],
  technician: ['repairs_manage', 'warranties_view', 'customers_manage', 'notifications_view'],
  accountant: ['sales_view', 'expenses_manage', 'reports_view', 'mpesa_view', 'commissions_view', 'notifications_view'],
};

export function can(staff: Staff, action: string): boolean {
  const perms = ROLE_PERMISSIONS[staff.role] || [];
  return perms.includes('*') || perms.includes(action);
}

export async function getSettings(): Promise<Settings> {
  const { items } = await db.list<Settings>('settings', { limit: 1 });
  if (items[0]) return items[0];
  const defaults: Omit<Settings, 'id'> = {
    businessName: 'STAR ELECTRONICS',
    tagline: 'Smart Technology. Trusted Service.',
    phone: '0700 123 456',
    email: 'info@starelectronics.co.ke',
    location: 'Moi Avenue, Nairobi, Kenya',
    currency: 'KES',
    taxRate: 16,
    invoicePrefix: 'STAR-INV-',
    invoiceCounter: 1,
    jobCardCounter: 1,
    receiptFooter: 'Thank you for shopping with Star Electronics!',
    warrantyDefaultMonths: 12,
    mpesaShortcode: '174379',
    negativeInventoryAllowed: false,
    cashierDiscountCapPercent: 5,
  };
  const [id] = await db.add('settings', [defaults]);
  return { id: id as string, ...defaults };
}

export async function nextInvoiceNumber(): Promise<string> {
  const settings = await getSettings();
  const num = settings.invoiceCounter;
  await db.update('settings', [{ id: settings.id, record: { ...settings, invoiceCounter: num + 1 } }]);
  return `${settings.invoicePrefix}${String(num).padStart(6, '0')}`;
}

export async function nextJobCardNumber(): Promise<string> {
  const settings = await getSettings();
  const num = settings.jobCardCounter;
  await db.update('settings', [{ id: settings.id, record: { ...settings, jobCardCounter: num + 1 } }]);
  return `STAR-JOB-${String(num).padStart(5, '0')}`;
}

export async function logAudit(staff: Staff | null, action: string, details: string): Promise<void> {
  await db.add('auditLogs', [{
    staffId: staff?.id || 'system',
    staffName: staff?.fullName || 'System',
    action,
    details,
    date: new Date().toISOString(),
  }]);
}

export async function notify(type: string, message: string, relatedId = ''): Promise<void> {
  await db.add('notifications', [{ type, message, read: false, date: new Date().toISOString(), relatedId }]);
}
