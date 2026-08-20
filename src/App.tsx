import { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ToastProvider, useAuth } from './lib/context';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import SuppliersPurchases from './pages/SuppliersPurchases';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import RepairsWarranties from './pages/RepairsWarranties';
import Expenses from './pages/Expenses';
import StaffCommissions from './pages/StaffCommissions';
import Reports from './pages/Reports';
import MpesaNotifications from './pages/MpesaNotifications';
import SettingsPage from './pages/Settings';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { staff, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!staff) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { staff, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && staff ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
      <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><SuppliersPurchases /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/repairs" element={<ProtectedRoute><RepairsWarranties /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><StaffCommissions /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/mpesa" element={<ProtectedRoute><MpesaNotifications /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
