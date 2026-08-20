import { useEffect, useState } from 'react';
import { Plus, Truck, Package, Pencil, Trash2, Banknote } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDate } from '../lib/util';
import { Modal, Button, Badge, Input, Select, EmptyState } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

export default function SuppliersPurchases() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'suppliers' | 'purchases'>('suppliers');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [supModal, setSupModal] = useState(false);
  const [editingSup, setEditingSup] = useState<any | null>(null);
  const [supForm, setSupForm] = useState({ name: '', company: '', phone: '', email: '', location: '', address: '' });

  const [purModal, setPurModal] = useState(false);
  const [purSupplierId, setPurSupplierId] = useState('');
  const [purItems, setPurItems] = useState<{ productId: string; qty: string; purchasePrice: string }[]>([{ productId: '', qty: '1', purchasePrice: '' }]);
  const [purPaid, setPurPaid] = useState('0');

  const [payModal, setPayModal] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');

  const load = () => {
    apiClient.get('/api/suppliers').then((res) => setSuppliers(res.data.suppliers));
    apiClient.get('/api/purchases').then((res) => setPurchases(res.data.purchases));
    apiClient.get('/api/products').then((res) => setProducts(res.data.products));
  };
  useEffect(load, []);

  const openAddSupplier = () => {
    setEditingSup(null);
    setSupForm({ name: '', company: '', phone: '', email: '', location: '', address: '' });
    setSupModal(true);
  };
  const openEditSupplier = (s: any) => {
    setEditingSup(s);
    setSupForm(s);
    setSupModal(true);
  };
  const saveSupplier = async () => {
    if (!supForm.name) return toast('Supplier name is required.', 'error');
    if (editingSup) await apiClient.put(`/api/suppliers/${editingSup.id}`, supForm);
    else await apiClient.post('/api/suppliers', supForm);
    setSupModal(false);
    toast('Supplier saved.', 'success');
    load();
  };
  const deleteSupplier = async (s: any) => {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    await apiClient.del(`/api/suppliers/${s.id}`);
    load();
  };

  const addPurItem = () => setPurItems([...purItems, { productId: '', qty: '1', purchasePrice: '' }]);
  const updatePurItem = (i: number, field: string, value: string) => setPurItems(purItems.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const removePurItem = (i: number) => setPurItems(purItems.filter((_, idx) => idx !== i));

  const savePurchase = async () => {
    if (!purSupplierId) return toast('Select a supplier.', 'error');
    const items = purItems.filter((it) => it.productId && Number(it.qty) > 0).map((it) => ({ productId: it.productId, qty: Number(it.qty), purchasePrice: Number(it.purchasePrice) || undefined }));
    if (items.length === 0) return toast('Add at least one product.', 'error');
    try {
      await apiClient.post('/api/purchases', { supplierId: purSupplierId, items, amountPaid: Number(purPaid) || 0 });
      toast('Stock received and inventory updated.', 'success');
      setPurModal(false);
      setPurItems([{ productId: '', qty: '1', purchasePrice: '' }]);
      setPurPaid('0');
      setPurSupplierId('');
      load();
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not record the purchase.', 'error');
    }
  };

  const recordPayment = async () => {
    if (!payModal) return;
    await apiClient.post(`/api/purchases/${payModal.id}/pay`, { amount: Number(payAmount) || 0 });
    toast('Supplier payment recorded.', 'success');
    setPayModal(null);
    setPayAmount('');
    load();
  };

  const canManage = can('suppliers_manage');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers & Purchases</h1>
          <p className="text-sm text-slate-500">Manage suppliers and receive stock into inventory</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openAddSupplier}><Plus size={16} /> Add Supplier</Button>
            <Button onClick={() => setPurModal(true)}><Package size={16} /> Receive Stock</Button>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button onClick={() => setTab('suppliers')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'suppliers' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>Suppliers</button>
        <button onClick={() => setTab('purchases')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'purchases' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>Purchase History</button>
      </div>

      {tab === 'suppliers' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#1e40af]"><Truck size={18} /></div>
                  <div>
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.location}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openEditSupplier(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                    <button onClick={() => deleteSupplier(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-3">{s.phone}</p>
              <p className="text-sm text-slate-500">{s.email}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Amount Owed</span>
                <Badge color={s.amountOwed > 0 ? 'amber' : 'green'}>{formatKES(s.amountOwed)}</Badge>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <EmptyState icon={<Truck size={26} />} title="No suppliers yet" />}
        </div>
      )}

      {tab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Items</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {purchases.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">{formatDate(p.date)}</td>
                  <td className="px-4 py-3">{suppliers.find((s) => s.id === p.supplierId)?.name || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.items.length} line(s)</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatKES(p.totalCost)}</td>
                  <td className="px-4 py-3 text-right">{formatKES(p.balance)}</td>
                  <td className="px-4 py-3"><Badge color={p.balance > 0 ? 'amber' : 'green'}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {p.balance > 0 && canManage && (
                      <button onClick={() => setPayModal(p)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><Banknote size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {purchases.length === 0 && <EmptyState icon={<Package size={26} />} title="No purchases recorded yet" />}
        </div>
      )}

      <Modal open={supModal} onClose={() => setSupModal(false)} title={editingSup ? 'Edit Supplier' : 'Add Supplier'}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Supplier Name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
          <Input label="Company" value={supForm.company} onChange={(e) => setSupForm({ ...supForm, company: e.target.value })} />
          <Input label="Phone" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
          <Input label="Email" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
          <Input label="Location" value={supForm.location} onChange={(e) => setSupForm({ ...supForm, location: e.target.value })} />
          <Input label="Address" value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setSupModal(false)}>Cancel</Button>
          <Button onClick={saveSupplier}>Save</Button>
        </div>
      </Modal>

      <Modal open={purModal} onClose={() => setPurModal(false)} title="Receive Stock" wide>
        <Select label="Supplier" value={purSupplierId} onChange={(e) => setPurSupplierId(e.target.value)}>
          <option value="">Select supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <div className="mt-4 space-y-2">
          {purItems.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6">
                <Select label={i === 0 ? 'Product' : undefined} value={it.productId} onChange={(e) => updatePurItem(i, 'productId', e.target.value)}>
                  <option value="">Select product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3">
                <Input label={i === 0 ? 'Qty' : undefined} type="number" value={it.qty} onChange={(e) => updatePurItem(i, 'qty', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input label={i === 0 ? 'Unit Cost' : undefined} type="number" value={it.purchasePrice} onChange={(e) => updatePurItem(i, 'purchasePrice', e.target.value)} />
              </div>
              <div className="col-span-1">
                <Button variant="ghost" size="sm" onClick={() => removePurItem(i)}><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" className="mt-2" onClick={addPurItem}><Plus size={14} /> Add Line</Button>
        <div className="mt-4">
          <Input label="Amount Paid Now (KES)" type="number" value={purPaid} onChange={(e) => setPurPaid(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setPurModal(false)}>Cancel</Button>
          <Button onClick={savePurchase}>Receive Stock</Button>
        </div>
      </Modal>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Supplier Payment">
        <p className="text-sm text-slate-500 mb-3">Outstanding balance: <strong>{formatKES(payModal?.balance || 0)}</strong></p>
        <Input label="Amount to pay (KES)" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setPayModal(null)}>Cancel</Button>
          <Button onClick={recordPayment}>Record Payment</Button>
        </div>
      </Modal>
    </div>
  );
}
