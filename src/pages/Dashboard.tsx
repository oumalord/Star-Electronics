import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, ShoppingBag, Users, Truck, AlertTriangle, PackageX, Wrench, Wallet, Smartphone } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { apiClient } from '../lib/api';
import { formatKES } from '../lib/util';
import { StatCard, Skeleton, Badge } from '../components/UI';
import { useToast } from '../lib/context';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

const PIE_COLORS = ['#1e40af', '#f59e0b', '#10b981', '#64748b'];

export default function Dashboard() {
  const { toast } = useToast();
  const [range, setRange] = useState('today');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/api/dashboard', { range }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [range]);

  const paymentData = data ? Object.entries(data.byMethod).filter(([, v]: any) => v > 0).map(([name, value]) => ({ name, value })) : [];
  const openRegister = async () => {
    const value = window.prompt('Opening cash balance for today (KES)', String(data?.cashRegister?.openingBalance || 0));
    if (value === null) return;
    try {
      await apiClient.post('/api/cash-register/open', { openingBalance: Number(value) });
      const res = await apiClient.get('/api/dashboard', { range });
      setData(res.data);
      toast('Opening balance saved.', 'success');
    } catch (e: any) { toast(e?.response?.data?.error || 'Could not save opening balance.', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Dashboard</h1>
          <p className="text-sm text-slate-500">Welcome back — here's how Star Electronics is performing.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${range === r.key ? 'bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.financeVisible && <StatCard label="Total Sales" value={formatKES(data.totalSales)} icon={<TrendingUp size={22} />} accent="blue" sub={`${data.transactionsCount} transactions`} />}
            {data.financeVisible && <StatCard label="Total Profit" value={formatKES(data.totalProfit)} icon={<BarChart3 size={22} />} accent="green" />}
            <StatCard label="Products Sold" value={String(data.productsSold)} icon={<ShoppingBag size={22} />} accent="gold" />
            {data.financeVisible && <StatCard label="M-Pesa Sales" value={formatKES(data.byMethod.mpesa || 0)} icon={<Smartphone size={22} />} accent="dark" />}
            <StatCard label="Low Stock Items" value={String(data.lowStock)} icon={<AlertTriangle size={22} />} accent="red" />
            <StatCard label="Out of Stock" value={String(data.outOfStock)} icon={<PackageX size={22} />} accent="red" />
            <StatCard label="Pending Repairs" value={String(data.pendingRepairs)} icon={<Wrench size={22} />} accent="blue" />
            {data.financeVisible && <StatCard label="Expenses" value={formatKES(data.expensesTotal)} icon={<Wallet size={22} />} accent="gold" />}
          </div>

          {data.financeVisible && <div className="bg-[#0b1526] rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><p className="text-sm text-slate-300">Today's cash register</p><p className="text-xs text-slate-400 mt-1">Opening + cash sales - cash expenses</p></div>
            <div className="grid grid-cols-3 gap-3 text-right"><div><p className="text-[10px] uppercase text-slate-400">Opening</p><p className="font-bold">{formatKES(data.cashRegister.openingBalance)}</p></div><div><p className="text-[10px] uppercase text-slate-400">Closing</p><p className="font-bold text-amber-300">{formatKES(data.cashRegister.closingBalance)}</p></div><button onClick={openRegister} className="text-xs text-blue-200 hover:text-white underline">{data.cashRegister.isOpened ? 'Edit opening' : 'Set opening'}</button></div>
          </div>}

          {data.financeVisible && <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div><p className="font-bold text-slate-900">Inventory balance</p><p className="text-xs text-slate-500 mt-1">Opening and closing stock for the selected period, valued at purchase cost</p></div>
              <span className="text-xs font-semibold text-slate-500">{data.inventoryBalance.stockReceivedUnits} received · {data.inventoryBalance.stockSoldUnits} sold</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] uppercase text-slate-500">Opening stock</p><p className="text-lg font-bold text-slate-900">{data.inventoryBalance.openingStockUnits} units</p><p className="text-xs text-slate-500">{formatKES(data.inventoryBalance.openingStockValue)}</p></div>
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-[10px] uppercase text-blue-700">Closing stock</p><p className="text-lg font-bold text-blue-900">{data.inventoryBalance.closingStockUnits} units</p><p className="text-xs text-blue-700">{formatKES(data.inventoryBalance.closingStockValue)}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] uppercase text-emerald-700">Stock received</p><p className="text-lg font-bold text-emerald-900">{data.inventoryBalance.stockReceivedUnits} units</p><p className="text-xs text-emerald-700">Purchases in period</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] uppercase text-amber-700">Stock sold</p><p className="text-lg font-bold text-amber-900">{data.inventoryBalance.stockSoldUnits} units</p><p className="text-xs text-amber-700">Paid sales in period</p></div>
            </div>
          </div>}

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="font-bold text-slate-900 mb-4">Sales Trend (Last 7 Days)</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip formatter={(v: any) => formatKES(Number(v))} />
                  <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="font-bold text-slate-900 mb-4">Payment Methods</p>
              {paymentData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-16">No payments in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {paymentData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatKES(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {paymentData.map((p, i) => (
                  <span key={p.name} className="text-xs flex items-center gap-1.5 text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="font-bold text-slate-900 mb-4">Best-Selling Products</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.bestSellers} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#1e40af" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="font-bold text-slate-900 mb-4">Products Requiring Restock</p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {data.lowStockProducts.length === 0 && <p className="text-sm text-slate-400 text-center py-8">All stock levels are healthy 🎉</p>}
                {data.lowStockProducts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-sm font-medium text-slate-700">{p.name}</span>
                    </div>
                    <Badge color={p.status === 'out_of_stock' ? 'red' : 'amber'}>{p.stock} left</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Customers" value={String(data.customersCount)} icon={<Users size={22} />} accent="blue" />
            <StatCard label="Suppliers" value={String(data.suppliersCount)} icon={<Truck size={22} />} accent="dark" />
            <StatCard label="Supplier Balances" value={formatKES(data.outstandingSupplierBalance)} icon={<Wallet size={22} />} accent="gold" />
            <StatCard label="Cash Sales" value={formatKES(data.byMethod.cash || 0)} icon={<TrendingUp size={22} />} accent="green" />
          </div>
        </>
      )}
    </div>
  );
}
