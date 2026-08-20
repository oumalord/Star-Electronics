import { db } from './neon';
import { newSalt, hashPin, getSettings } from './helpers';
import type { Staff } from './types';

const OWNER_USERNAME = 'admin';
const OWNER_PIN = '2114';

/**
 * Guarantees exactly one working owner login exists: username "admin",
 * PIN "2114". Runs on every login attempt. If that account is missing or
 * broken in any way, the entire staff table is wiped and a single clean
 * owner account is recreated. All other staff accounts are created from the
 * in-app Staff & Commissions page by the owner.
 */
export async function ensureOwnerAccount(): Promise<void> {
  const { items } = await db.list<Staff>('staff', { limit: 500 });
  const valid = items.find((s) => s.username === OWNER_USERNAME && s.status === 'active' && s.role === 'owner' && hashPin(OWNER_PIN, s.pinSalt) === s.pinHash);
  if (valid && items.filter((s) => s.username === OWNER_USERNAME).length === 1) return;

  if (items.length > 0) {
    await Promise.all(items.map((s) => db.delete('staff', [s.id])));
  }

  const salt = newSalt();
  const pinHash = hashPin(OWNER_PIN, salt);
  await db.add('staff', [{
    fullName: 'Administrator', username: OWNER_USERNAME, pinHash, pinSalt: salt, role: 'owner',
    phone: '', email: '', status: 'active', commissionPercent: 0, dateJoined: new Date().toISOString(),
  }]);
}

/** Ensures business settings exist. No demo catalog data is created. */
export async function ensureSeeded(): Promise<void> {
  await getSettings();
}

const DEMO_DATA_TABLES = ['categories', 'products', 'deviceUnits', 'suppliers', 'purchases', 'customers', 'sales', 'payments', 'mpesaTransactions', 'warranties', 'repairs', 'expenses', 'notifications', 'refunds'];

/**
 * One-time cleanup that removes all previously-seeded demo/catalog data
 * (products, customers, suppliers, sales, repairs, etc.) while leaving
 * staff, sessions, settings, and audit logs untouched. Safe to call
 * repeatedly - it records completion in a 'meta' table record so it only
 * ever does the deletion once.
 */
export async function purgeDemoDataOnce(): Promise<void> {
  const { items: marker } = await db.list('meta', { filter: { key: 'demoDataPurged' }, limit: 1 });
  if (marker.length > 0) return;

  for (const table of DEMO_DATA_TABLES) {
    const { items: rows } = await db.list<{ id: string }>(table, { limit: 1000 });
    if (rows.length > 0) {
      await Promise.all(rows.map((r) => db.delete(table, [r.id])));
    }
  }

  await db.add('meta', [{ key: 'demoDataPurged', value: true, purgedAt: new Date().toISOString() }]);
}
