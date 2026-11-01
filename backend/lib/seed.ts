import { db } from './neon.ts';
import { newSalt, hashPin, getSettings } from './helpers.ts';
import type { Staff } from './types.ts';

const OWNER_USERNAME = 'admin';
const OWNER_PIN = '2114';

/** Creates the demo owner account only when the staff table is empty. */
export async function ensureOwnerAccount(): Promise<void> {
  const { items } = await db.list<Staff>('staff', { limit: 500 });
  if (items.length > 0) return;

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
