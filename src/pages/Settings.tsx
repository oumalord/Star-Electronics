import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { apiClient } from '../lib/api';
import { Button, Input } from '../components/UI';
import { useToast } from '../lib/context';

export default function Settings() {
  const { toast } = useToast();
  const [form, setForm] = useState<any | null>(null);

  useEffect(() => {
    apiClient.get('/api/settings').then((res) => setForm(res.data.settings));
  }, []);

  const save = async () => {
    if (!form) return;
    try {
      await apiClient.put('/api/settings', form);
      toast('Business settings updated.', 'success');
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not save settings.', 'error');
    }
  };

  if (!form) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Business Settings</h1>
        <p className="text-sm text-slate-500">Configure Star Electronics' business information and system behavior</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="font-semibold text-slate-800">Business Information</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Business Name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <Input label="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="font-semibold text-slate-800">Sales & Tax</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <Input label="Tax Rate (%)" type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} />
          <Input label="Invoice Number Prefix" value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
          <Input label="Cashier Discount Cap (%)" type="number" value={form.cashierDiscountCapPercent} onChange={(e) => setForm({ ...form, cashierDiscountCapPercent: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.negativeInventoryAllowed} onChange={(e) => setForm({ ...form, negativeInventoryAllowed: e.target.checked })} />
          Allow selling products with zero stock (negative inventory)
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="font-semibold text-slate-800">Warranty & Receipts</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Default Warranty Period (months)" type="number" value={form.warrantyDefaultMonths} onChange={(e) => setForm({ ...form, warrantyDefaultMonths: Number(e.target.value) })} />
          <Input label="M-Pesa Business Shortcode" value={form.mpesaShortcode} onChange={(e) => setForm({ ...form, mpesaShortcode: e.target.value })} />
        </div>
        <label className="block">
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Receipt Footer Message</span>
          <textarea value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} rows={2} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="font-semibold text-slate-800">Numbering & Controls</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Next Invoice Number" type="number" min="1" value={form.invoiceCounter} onChange={(e) => setForm({ ...form, invoiceCounter: Number(e.target.value) })} />
          <Input label="Next Repair Job Card Number" type="number" min="1" value={form.jobCardCounter} onChange={(e) => setForm({ ...form, jobCardCounter: Number(e.target.value) })} />
        </div>
        <p className="text-xs text-slate-400">Changing these values affects the next invoice and repair job card generated.</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
        <Info size={18} className="text-[#1e40af] shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold">M-Pesa Daraja API credentials</p>
          <p className="mt-1 text-blue-800/80">The system currently runs M-Pesa STK Push in sandbox simulation mode. To go live, add <code className="bg-white/60 px-1 rounded">MPESA_CONSUMER_KEY</code>, <code className="bg-white/60 px-1 rounded">MPESA_CONSUMER_SECRET</code>, <code className="bg-white/60 px-1 rounded">MPESA_PASSKEY</code>, <code className="bg-white/60 px-1 rounded">MPESA_SHORTCODE</code> and <code className="bg-white/60 px-1 rounded">MPESA_CALLBACK_URL</code> as secure secrets — no code changes required.</p>
        </div>
      </div>

      <Button onClick={save}><Save size={16} /> Save Settings</Button>
    </div>
  );
}
