-- Run this file once in the Neon SQL Editor.
-- Records stay in JSONB so the existing application fields remain intact.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'staff', 'sessions', 'settings', 'categories', 'products', 'deviceUnits',
    'suppliers', 'purchases', 'customers', 'sales', 'payments',
    'mpesaTransactions', 'warranties', 'repairs', 'expenses', 'notifications',
    'refunds', 'auditLogs', 'meta', 'cashRegisters'
  ] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %I (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    $sql$, table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING gin (data)', table_name || '_data_idx', table_name);
  END LOOP;
END $$;

-- Optional verification: this should return 20 rows after the script finishes.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'staff', 'sessions', 'settings', 'categories', 'products', 'deviceUnits',
    'suppliers', 'purchases', 'customers', 'sales', 'payments',
    'mpesaTransactions', 'warranties', 'repairs', 'expenses', 'notifications',
    'refunds', 'auditLogs', 'meta', 'cashRegisters'
  )
ORDER BY table_name;
