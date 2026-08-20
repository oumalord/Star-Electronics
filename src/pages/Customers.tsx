import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Users, Phone, Mail, ShoppingBag } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDate, titleCase } from '../lib/util';
import { Modal, Button, Badge, Input, Select, EmptyState, ConfirmDialog } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

const EMPTY = { fullName: '', phone: '', email: '', address: '', customerType: 'walk_in' };

export default function Customers() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [history, setHistory] = useState<{ sales: any[]; warranties: any[] } | null>(null);

  const load = () => apiClient.get('/api/customers').then((res) => setCustomers(res.data.customers));
  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) => c.fullName.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm(c); setModalOpen(true); };
  const save = async () => {
    if (!form.fullName || !form.phone) return toast('Full name and phone are required.', 'error');
    if (editing) await apiClient.put(`/api/customers/${editing.id}`, form);
    else await apiClient.post('/api/customers', form);
    toast('Customer saved.', 'success');
    setModalOpen(false);
    load();
  };
  const remove = async (c: any) => {
    await apiClient.del(`/api/customers/${c.id}`);
    toast('Customer removed.', 'success');
    load();
  };
  const openProfile = async (c: any) => {
    setProfile(c);
    const res = await apiClient.get(`/api/customers/${c.id}/history`);
    setHistory(res.data);
  };

  const canManage = can('customers_manage');

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">{customers.length} customers on record</p>
        </div>
        {canManage && <Button onClick={openAdd} className="w-full sm:w-auto"><Plus size={16} /> Add Customer</Button>}
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openProfile(c)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e40af] to-[#2563eb] flex items-center justify-center text-white font-bold">{c.fullName.charAt(0)}</div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{c.fullName}</p>
                  <Badge color={c.customerType === 'business' ? 'purple' : c.customerType === 'regular' ? 'blue' : 'slate'}>{titleCase(c.customerType)}</Badge>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-3 flex items-center gap-1.5 min-w-0"><Phone size={13} className="shrink-0" /> <span className="truncate">{c.phone}</span></p>
            {c.email && <p className="text-sm text-slate-500 flex items-center gap-1.5 min-w-0"><Mail size={13} className="shrink-0" /> <span className="truncate">{c.email}</span></p>}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Lifetime Value</span>
              <span className="font-bold text-[#1e40af]">{formatKES(c.totalSpent)}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full"><EmptyState icon={<Users size={26} />} title="No customers found" /></div>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select label="Customer Type" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
            <option value="walk_in">Walk-in</option>
            <option value="regular">Regular</option>
            <option value="business">Business</option>
          </Select>
        </div>
        <div className="mt-3">
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={save} className="w-full sm:w-auto">Save</Button>
        </div>
      </Modal>

      <Modal open={!!profile} onClose={() => setProfile(null)} title={profile?.fullName || ''} wide>
        {profile && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Lifetime Value</p>
                <p className="font-bold text-[#1e40af]">{formatKES(profile.totalSpent)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Total Purchases</p>
                <p className="font-bold text-slate-800">{history?.sales.length || 0}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Warranty Items</p>
                <p className="font-bold text-slate-800">{history?.warranties.length || 0}</p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5"><ShoppingBag size={15} /> Purchase History</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {history?.sales.map((s) => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3 py-2 rounded-lg bg-slate-50 text-sm">
                    <span className="truncate">{s.invoiceNumber} · {formatDate(s.date)}</span>
                    <span className="font-semibold">{formatKES(s.total)}</span>
                  </div>
                ))}
                {history?.sales.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No purchases yet</p>}
              </div>
            </div>
            {history && history.warranties.length > 0 && (
              <div>
                <p className="font-semibold text-slate-800 mb-2">Warranty Items</p>
                <div className="space-y-1.5">
                  {history.warranties.map((w) => (
                    <div key={w.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3 py-2 rounded-lg bg-slate-50 text-sm">
                      <span className="truncate">{w.productName}</span>
                      <span className="text-xs text-slate-400">Expires {formatDate(w.expiryDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove(deleteTarget)} title="Delete Customer" message={`Remove "${deleteTarget?.fullName}" from your customer list?`} danger />
    </div>
  );
}
