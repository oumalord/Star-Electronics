import { useEffect, useState } from 'react';
import { Smartphone, Bell, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDateTime, titleCase } from '../lib/util';
import { Badge, EmptyState } from '../components/UI';

export default function MpesaNotifications() {
  const [tab, setTab] = useState<'mpesa' | 'notifications'>('mpesa');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  const load = () => {
    apiClient.get('/api/mpesa/transactions').then((res) => setTransactions(res.data.transactions));
    apiClient.get('/api/notifications').then((res) => setNotifications(res.data.notifications));
  };
  useEffect(load, []);

  const markRead = async (n: any) => {
    await apiClient.post(`/api/notifications/${n.id}/read`, {});
    load();
  };

  const statusInfo: Record<string, { color: 'green' | 'red' | 'amber'; icon: typeof CheckCircle2 }> = {
    successful: { color: 'green', icon: CheckCircle2 },
    failed: { color: 'red', icon: XCircle },
    cancelled: { color: 'red', icon: XCircle },
    timeout: { color: 'red', icon: XCircle },
    pending: { color: 'amber', icon: Clock },
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">M-Pesa & Alerts</h1>
        <p className="text-sm text-slate-500">Track STK Push payments and system notifications</p>
      </div>

      <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button onClick={() => setTab('mpesa')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'mpesa' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>M-Pesa Transactions</button>
        <button onClick={() => setTab('notifications')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'notifications' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>
          Notifications {notifications.filter((n) => !n.read).length > 0 && <span className="ml-1 text-red-500">({notifications.filter((n) => !n.read).length})</span>}
        </button>
      </div>

      {tab === 'mpesa' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Checkout Request ID</th>
                <th className="text-left px-4 py-3">Result</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((t) => {
                const info = statusInfo[t.status] || statusInfo.pending;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3">{t.phone}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatKES(t.amount)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{t.checkoutRequestId}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{t.resultDesc || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge color={info.color}>
                        <span className="inline-flex items-center gap-1"><info.icon size={12} /> {titleCase(t.status)}</span>
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {transactions.length === 0 && <EmptyState icon={<Smartphone size={26} />} title="No M-Pesa transactions yet" />}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${!n.read ? 'bg-blue-50/40' : ''}`} onClick={() => markRead(n)}>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0"><Bell size={15} /></div>
              <div className="flex-1">
                <p className="text-sm text-slate-700">{n.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(n.date)}</p>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563eb] mt-1.5" />}
            </div>
          ))}
          {notifications.length === 0 && <EmptyState icon={<Bell size={26} />} title="No notifications" />}
        </div>
      )}
    </div>
  );
}
