import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

type RecordValue = { id?: string; [key: string]: any };
type Filter = Record<string, string | number | boolean>;
type ListOptions = { filter?: Filter; limit?: number };

type Db = {
  get: <T extends RecordValue>(table: string, ids: string[]) => Promise<T[]>;
  list: <T extends RecordValue>(table: string, options?: ListOptions) => Promise<{ items: T[] }>;
  add: (table: string, records: RecordValue[]) => Promise<string[]>;
  update: (table: string, updates: { id: string; record: RecordValue }[]) => Promise<void>;
  delete: (table: string, ids: string[]) => Promise<void>;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to connect to Neon.');

const sql = neon(connectionString);

const TABLES = new Set([
  'staff', 'sessions', 'settings', 'categories', 'products', 'deviceUnits', 'suppliers', 'purchases',
  'customers', 'sales', 'payments', 'mpesaTransactions', 'warranties', 'repairs', 'expenses',
  'notifications', 'refunds', 'auditLogs', 'meta', 'cashRegisters',
]);

function tableName(table: string): string {
  if (!TABLES.has(table)) throw new Error(`Invalid table name: ${table}`);
  return table;
}

function filterEntries(filter: Filter = {}): { clause: string; values: unknown[] } {
  const entries = Object.entries(filter);
  return {
    clause: entries.map((_, index) => `(data->>$${index * 2 + 1}) = $${index * 2 + 2}`).join(' AND '),
    values: entries.flatMap(([key, value]) => [key, String(value)]),
  };
}

export const db: Db = {
  async get<T extends RecordValue>(table: string, ids: string[]) {
    if (ids.length === 0) return [];
    const safeTable = tableName(table);
    const rows = await sql.query(`SELECT data FROM "${safeTable}" WHERE id = ANY($1::text[])`, [ids]);
    return rows.map((row: any) => row.data as T);
  },

  async list<T extends RecordValue>(table: string, options: ListOptions = {}) {
    const safeTable = tableName(table);
    const { clause, values } = filterEntries(options.filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (clause) {
      where.push(clause);
      params.push(...values);
    }
    const limit = Math.max(1, Math.min(options.limit || 100, 5000));
    params.push(limit);
    const rows = await sql.query(`SELECT data FROM "${safeTable}"${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length}`, params);
    return { items: rows.map((row: any) => row.data as T) };
  },

  async add(table, records) {
    const safeTable = tableName(table);
    if (records.length === 0) return [];
    const ids = records.map((record) => record.id || crypto.randomUUID());
    await sql.transaction(records.map((record, index) => sql.query(`INSERT INTO "${safeTable}" (id, data) VALUES ($1, $2::jsonb)`, [ids[index], JSON.stringify({ ...record, id: ids[index] })])));
    return ids;
  },

  async update(table, updates) {
    const safeTable = tableName(table);
    await sql.transaction(updates.map(({ id, record }) => sql.query(`UPDATE "${safeTable}" SET data = $1::jsonb, updated_at = now() WHERE id = $2`, [JSON.stringify({ ...record, id }), id])));
  },

  async delete(table, ids) {
    if (ids.length === 0) return;
    const safeTable = tableName(table);
    await sql.query(`DELETE FROM "${safeTable}" WHERE id = ANY($1::text[])`, [ids]);
  },
};
