import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Receipt, Package, Truck, Users, Wrench, Wallet, UserCog, BarChart3, Smartphone, Settings as SettingsIcon, LogOut, Search, Bell, Menu, X, Star } from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { apiClient } from '../lib/api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: null as string | null },
  { to: '/pos', label: 'Point of Sale', icon: ShoppingCart, perm: 'pos' },
  { to: '/sales', label: 'Sales & Invoices', icon: Receipt, perm: 'sales_view' },
  { to: '/products', label: 'Products & Inventory', icon: Package, perm: 'products_view' },
  { to: '/suppliers', label: 'Suppliers & Purchases', icon: Truck, perm: 'purchases_manage' },
  { to: '/customers', label: 'Customers', icon: Users, perm: 'customers_manage' },
  { to: '/repairs', label: 'Repairs & Warranties', icon: Wrench, perm: 'repairs_manage' },
  { to: '/expenses', label: 'Expenses', icon: Wallet, perm: 'expenses_manage' },
  { to: '/staff', label: 'Staff & Commissions', icon: UserCog, perm: 'staff_view' },
  { to: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports_view' },
  { to: '/mpesa', label: 'M-Pesa & Alerts', icon: Smartphone, perm: 'mpesa_view' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, perm: 'settings_manage' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { staff, logout, can } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<string, any[]> | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    apiClient
      .get('/api/notifications')
      .then((res) => setUnread(res.data.notifications.filter((n: any) => !n.read).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      apiClient.get('/api/search', { q: query }).then((res) => setResults(res.data)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const visibleNav = NAV.filter((n) => !n.perm || can(n.perm) || (n.perm === 'purchases_manage' && can('suppliers_manage')));
  const resultKeys = ['products', 'customers', 'sales', 'repairs', 'suppliers', 'devices'];

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 flex">
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-72 bg-[#0b1526] text-white flex flex-col transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Star className="text-[#0b1526]" size={22} fill="#0b1526" />
          </div>
          <div>
            <p className="font-extrabold text-lg leading-tight tracking-tight">
              STAR<span className="text-[#fbbf24]">ELECTRONICS</span>
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Smart Technology. Trusted Service.</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-gradient-to-b from-[#2563eb] to-[#1e40af] text-white shadow-[0_4px_16px_-4px_rgba(37,99,235,0.6)]' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] flex items-center justify-center text-[#0b1526] font-bold text-sm">{staff?.fullName.charAt(0)}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{staff?.fullName}</p>
              <p className="text-xs text-slate-400 capitalize">{staff?.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              toast('Logged out successfully', 'info');
              navigate('/login');
            }}
            className="mt-2 w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center gap-4">
          <button className="lg:hidden text-slate-500" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, customers, invoices, IMEI..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30" />
            {results && (
              <div className="absolute mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 max-h-96 overflow-y-auto z-50">
                {resultKeys.map(
                  (k) =>
                    results[k]?.length > 0 && (
                      <div key={k} className="p-2 border-b border-slate-50 last:border-0">
                        <p className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">{k}</p>
                        {results[k].map((r: any) => (
                          <div key={r.id} className="px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sm text-slate-700">
                            {r.name || r.fullName || r.invoiceNumber || r.jobCardNumber || r.serial}
                          </div>
                        ))}
                      </div>
                    )
                )}
                {resultKeys.every((k) => !results[k] || results[k].length === 0) && <p className="p-4 text-sm text-slate-400 text-center">No results found</p>}
              </div>
            )}
          </div>
          <button onClick={() => navigate('/mpesa')} className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <Bell size={20} />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </header>
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
