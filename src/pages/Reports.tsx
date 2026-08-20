import { useEffect, useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDate, titleCase } from '../lib/util';
import { Button, EmptyState } from '../components/UI';

const REPORT_TYPES = [
  { key: 'sales', label: 'Sales & Profit' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'category', label: 'By Category' },
  { key: 'staff', label: 'Staff Performance' },
  { key: 'customers', label: 'Top Customers' },
  { key: 'suppliers', label: 'Supplier Balances' },
  { key: 'expenses', label: 'Expenses' },
];

export default function Reports() {
  const [type, setType] = useState('sales');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/api/reports', { type }).then((res) => setRows(res.data.rows)).finally(() => setLoading(false));
  }, [type]);

  const columns = getColumns(type);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const headers = columns.map((c) => c.label);
    const csvRows = [headers.join(','), ...rows.map((r) => columns.map((c) => `"${String(c.render ? c.render(r) : r[c.key]).replace(/"/g, '""')}"`).join(','))];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `star-electronics-${type}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports Center</h1>
          <p className="text-sm text-slate-500">Comprehensive business reports for Star Electronics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}><Download size={16} /> Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
        </div>
      </div>

      <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit overflow-x-auto">
        {REPORT_TYPES.map((r) => (
          <button key={r.key} onClick={() => setType(r.key)} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${type === r.key ? 'bg-[#1e40af] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.render ? c.render(r) : r[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <EmptyState icon={<BarChart3 size={26} />} title="No data for this report yet" />}
        </div>
      </div>
    </div>
  );
}

function getColumns(type: string): { key: string; label: string; align?: 'right'; render?: (r: any) => any }[] {
  switch (type) {
    case 'sales':
      return [
        { key: 'invoiceNumber', label: 'Invoice' },
        { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
        { key: 'customerName', label: 'Customer' },
        { key: 'staffName', label: 'Cashier' },
        { key: 'paymentMethod', label: 'Payment', render: (r) => titleCase(r.paymentMethod) },
        { key: 'total', label: 'Total', align: 'right', render: (r) => formatKES(r.total) },
        { key: 'profit', label: 'Profit', align: 'right', render: (r) => formatKES(r.profit) },
      ];
    case 'inventory':
      return [
        { key: 'name', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'stock', label: 'Stock', align: 'right' },
        { key: 'minStock', label: 'Min Level', align: 'right' },
        { key: 'status', label: 'Status', render: (r) => titleCase(r.status) },
        { key: 'valuation', label: 'Valuation', align: 'right', render: (r) => formatKES(r.valuation) },
      ];
    case 'category':
      return [
        { key: 'categoryId', label: 'Category' },
        { key: 'qty', label: 'Units Sold', align: 'right' },
        { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatKES(r.revenue) },
      ];
    case 'staff':
      return [
        { key: 'name', label: 'Staff' },
        { key: 'role', label: 'Role', render: (r) => titleCase(r.role) },
        { key: 'salesCount', label: 'Sales', align: 'right' },
        { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => formatKES(r.revenue) },
        { key: 'commission', label: 'Commission', align: 'right', render: (r) => formatKES(r.commission) },
      ];
    case 'customers':
      return [
        { key: 'name', label: 'Customer' },
        { key: 'phone', label: 'Phone' },
        { key: 'purchases', label: 'Purchases', align: 'right' },
        { key: 'totalSpent', label: 'Total Spent', align: 'right', render: (r) => formatKES(r.totalSpent) },
      ];
    case 'suppliers':
      return [
        { key: 'name', label: 'Supplier' },
        { key: 'phone', label: 'Phone' },
        { key: 'amountOwed', label: 'Amount Owed', align: 'right', render: (r) => formatKES(r.amountOwed) },
      ];
    case 'expenses':
      return [
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatKES(r.amount) },
      ];
    default:
      return [];
  }
}
