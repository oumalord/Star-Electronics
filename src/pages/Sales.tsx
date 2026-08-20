import { useEffect, useState } from 'react';
import { Search, Receipt, RotateCcw, Ban, Eye } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDateTime, titleCase } from '../lib/util';
import { Modal, Button, Badge, EmptyState, Input } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

export default function Sales() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<any | null>(null);
  const [refundModal, setRefundModal] = useState<any | null>(null);
  const [refundQty, setRefundQty] = useState<Record<number, number>>({});
  const [refundReason, setRefundReason] = useState('');

  const load = () => apiClient.get('/api/sales').then((res) => setSales(res.data.sales));
  useEffect(() => { load(); }, []);

  const filtered = sales.filter((s) => s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || s.customerName.toLowerCase().includes(search.toLowerCase()));

  const openRefund = (s: any) => {
    setRefundModal(s);
    setRefundQty({});
    setRefundReason('');
  };

  const submitRefund = async () => {
    if (!refundModal) return;
    const items = Object.entries(refundQty).filter(([, q]) => q > 0).map(([idx, qty]) => ({ saleItemIndex: Number(idx), qty }));
    if (items.length === 0) return toast('Select at least one item and quantity to refund.', 'error');
    try {
      await apiClient.post(`/api/sales/${refundModal.id}/refund`, { items, reason: refundReason, method: refundModal.paymentMethod });
      toast('Refund processed successfully.', 'success');
      setRefundModal(null);
      load();
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not process refund.', 'error');
    }
  };

  const cancelSale = async (s: any) => {
    if (!confirm(`Cancel pending sale ${s.invoiceNumber}?`)) return;
    try {
      await apiClient.post(`/api/sales/${s.id}/cancel`, {});
      toast('Sale cancelled.', 'success');
      load();
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not cancel sale.', 'error');
    }
  };

  const statusColor = (s: any) => (s.status === 'completed' ? 'green' : s.status === 'cancelled' ? 'red' : s.status === 'refunded' ? 'slate' : 'amber');

  return (
    <div className="space-y-5 min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales & Invoices</h1>
        <p className="text-sm text-slate-500">{sales.length} transactions recorded</p>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice number or customer..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Cashier</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-semibold text-slate-800">{s.invoiceNumber}</td>
                <td className="px-4 py-3">{s.customerName}</td>
                <td className="px-4 py-3 text-slate-500">{s.staffName}</td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(s.date)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatKES(s.total)}</td>
                <td className="px-4 py-3"><Badge color="blue">{titleCase(s.paymentMethod)}</Badge></td>
                <td className="px-4 py-3"><Badge color={statusColor(s)}>{titleCase(s.status)}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewing(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Eye size={15} /></button>
                    {can('refunds_authorize') && s.status === 'completed' && s.paymentStatus === 'paid' && (
                      <button onClick={() => openRefund(s)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"><RotateCcw size={15} /></button>
                    )}
                    {can('refunds_authorize') && s.paymentStatus === 'pending' && (
                      <button onClick={() => cancelSale(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Ban size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map((s) => (
            <div key={s.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-semibold text-slate-800 truncate">{s.invoiceNumber}</p><p className="text-xs text-slate-500 truncate">{s.customerName}</p></div>
                <p className="font-bold text-slate-900 whitespace-nowrap">{formatKES(s.total)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{formatDateTime(s.date)}</span><Badge color="blue">{titleCase(s.paymentMethod)}</Badge><Badge color={statusColor(s)}>{titleCase(s.status)}</Badge></div>
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setViewing(s)}><Eye size={14} /> View</Button>
                {can('refunds_authorize') && s.status === 'completed' && s.paymentStatus === 'paid' && <Button size="sm" variant="gold" onClick={() => openRefund(s)}><RotateCcw size={14} /> Refund</Button>}
                {can('refunds_authorize') && s.paymentStatus === 'pending' && <Button size="sm" variant="danger" onClick={() => cancelSale(s)}><Ban size={14} /> Cancel</Button>}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <EmptyState icon={<Receipt size={26} />} title="No sales found" />}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Invoice ${viewing?.invoiceNumber || ''}`}>
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-500">
              <p>Customer: <span className="text-slate-800 font-medium">{viewing.customerName}</span></p>
              <p>Cashier: <span className="text-slate-800 font-medium">{viewing.staffName}</span></p>
              <p>Date: <span className="text-slate-800 font-medium">{formatDateTime(viewing.date)}</span></p>
              <p>Payment: <span className="text-slate-800 font-medium">{titleCase(viewing.paymentMethod)}</span></p>
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              {viewing.items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{it.qty}x {it.productName}</span>
                  <span className="whitespace-nowrap">{formatKES(it.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatKES(viewing.subtotal)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{formatKES(viewing.discountTotal)}</span></div>
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatKES(viewing.total)}</span></div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!refundModal} onClose={() => setRefundModal(null)} title={`Refund — ${refundModal?.invoiceNumber || ''}`} wide>
        {refundModal && (
          <div className="space-y-3">
            {refundModal.items.map((it: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{it.productName}</p>
                  <p className="text-xs text-slate-400">Sold qty: {it.qty} · {formatKES(it.total / it.qty)} each</p>
                </div>
                <Input type="number" min={0} max={it.qty} value={refundQty[i] || 0} onChange={(e) => setRefundQty({ ...refundQty, [i]: Math.min(it.qty, Math.max(0, Number(e.target.value))) })} className="w-20" />
              </div>
            ))}
            <Input label="Return Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Defective item, wrong item purchased" />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setRefundModal(null)} className="w-full sm:w-auto">Cancel</Button>
              <Button variant="danger" onClick={submitRefund} className="w-full sm:w-auto">Process Refund</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
