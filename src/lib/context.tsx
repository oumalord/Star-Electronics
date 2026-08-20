import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { apiClient, setToken, clearToken, getStoredToken } from './api';

export interface Staff {
  id: string;
  fullName: string;
  username: string;
  role: string;
  phone: string;
  email: string;
  status: string;
  commissionPercent: number;
  dateJoined: string;
}

interface AuthContextValue {
  staff: Staff | null;
  loading: boolean;
  login: (username: string, pin: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  can: (action: string) => boolean;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  manager: ['pos', 'sales_view', 'products_view', 'products_manage', 'stock_adjust', 'suppliers_manage', 'purchases_manage', 'customers_manage', 'repairs_manage', 'warranties_view', 'expenses_manage', 'staff_view', 'commissions_view', 'reports_view', 'mpesa_view', 'finance_view', 'refunds_authorize', 'discounts_unlimited', 'notifications_view'],
  sales: ['pos', 'sales_view', 'products_view', 'customers_manage', 'warranties_view', 'notifications_view'],
  inventory: ['products_view', 'products_manage', 'stock_adjust', 'suppliers_manage', 'purchases_manage', 'reports_view', 'notifications_view'],
  technician: ['repairs_manage', 'warranties_view', 'customers_manage', 'notifications_view'],
  accountant: ['sales_view', 'expenses_manage', 'reports_view', 'mpesa_view', 'commissions_view', 'notifications_view'],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient.get('/api/auth/me').then((res) => setStaff(res.data.staff)).catch(() => clearToken()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    try {
      const res = await apiClient.post('/api/auth/login', { username, pin });
      setToken(res.data.token);
      setStaff(res.data.staff);
      return { ok: true };
    } catch (e: any) {
      if (e?.response?.status === 403 || e?.response?.status >= 500 || !e?.response) {
        return { ok: false, message: 'The backend API is not deployed at this address. Deploy backend/index.ts or set VITE_BACKEND_URL to the live API URL.' };
      }
      return { ok: false, message: e?.response?.data?.error || 'Invalid username or PIN.' };
    }
  }, []);

  const logout = useCallback(() => {
    apiClient.post('/api/auth/logout').catch(() => {});
    clearToken();
    setStaff(null);
  }, []);

  const can = useCallback(
    (action: string) => {
      if (!staff) return false;
      const perms = ROLE_PERMISSIONS[staff.role] || [];
      return perms.includes('*') || perms.includes(action);
    },
    [staff]
  );

  return <AuthContext.Provider value={{ staff, loading, login, logout, can }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
interface ToastContextValue {
  toast: (message: string, type?: ToastItem['type']) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

function toastClass(type: ToastItem['type']): string {
  const base = 'px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-sm';
  if (type === 'success') return `${base} bg-emerald-600`;
  if (type === 'error') return `${base} bg-red-600`;
  return `${base} bg-[#1e40af]`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={toastClass(t.type)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
