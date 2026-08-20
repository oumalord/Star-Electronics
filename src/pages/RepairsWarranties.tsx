import { useEffect, useState } from 'react';
import { Plus, Wrench, ShieldCheck, Search } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDate, titleCase } from '../lib/util';
import { Modal, Button, Badge, Input, Select, EmptyState } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

const STATUS_FLOW = ['received', 'diagnosing', 'awaiting_approval', 'awaiting_parts', 'repairing', 'ready_for_collection', 'collected', 'cancelled'];
const EMPTY = { customerName: '', customerPhone: '', deviceType: 'Smartphone', brand: '', model: '', serialOrImei: '', problemDescription: '', technicianName: '', estimatedCost: '', deposit: '', expectedDate: '' };

export default function RepairsWarranties() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'repairs' | 'warranties'>('repairs');
  const [repairs, setRepairs] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [detail, setDetail] = useState<any | null>(null);
  const [statusForm, setStatusForm] = useState({ status: '', finalCost: '', deposit: '' });

  const load = () => {
    apiClient.get('/api/repairs').then((res) => setRepairs(res.data.repairs));
    apiClient.get('/api/warranties').then((res) => setWarranties(res.data.warranties));
    apiClient.get('/api/staff').then((res) => setStaff(res.data.staff)).catch(() => {});
  };
  useEffect(load, []);

  const technicians = staff.filter((s) => s.role === 'technician' || s.role === 'owner' || s.role === 'manager');

  const filteredRepairs = repairs.filter((r) => r.jobCardNumber.toLowerCase().includes(search.toLowerCase()) || r.customerName.toLowerCase().includes(search.toLowerCase()) || r.serialOrImei.toLowerCase().includes(search.toLowerCase()));
  const filteredWarranties = warranties.filter((w) => w.customerName.toLowerCase().includes(search.toLowerCase()) || w.serial.toLowerCase().includes(search.toLowerCase()) || w.imei1.toLowerCase().includes(search.toLowerCase()) || w.invoiceNumber.toLowerCase().includes(search.toLowerCase()));

  const submitRepair = async () => {
    if (!form.customerName || !form.deviceType) return toast('Customer name and device type are required.', 'error');
    try {
      const res = await apiClient.post('/api/repairs', form);
      toast(`Repair logged as job card ${res.data.jobCardNumber}.`, 'success');
      setModalOpen(false);
      setForm(EMPTY);
      load();
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not log the repair.', 'error');
    }
  };

  const openDetail = (r: any) => {
    setDetail(r);
    setStatusForm({ status: r.status, finalCost: String(r.finalCost || ''), deposit: String(r.deposit || '') });
  };

  const updateRepair = async () => {
    if (!detail) return;
    await apiClient.put(`/api/repairs/${detail.id}`, statusForm);
    toast('Repair job updated.', 'success');
    setDetail(null);
    load();
  };

  const statusColor = (s: string) => (s === 'collected' ? 'green' : s === 'ready_for_collection' ? 'blue' : s === 'cancelled' ? 'red' : 'amber');
  const warrantyColor = (s: string) => (s === 'active' ? 'green' : s === 'expiring_soon' ? 'amber' : 'red');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Repairs & Warranties</h1>
          <p className="text-sm text-slate-500">{repairs.length} repair jobs · {warranties.length} warranty items</p>
        </div>
        {can('repairs_manage') && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Log Repair</Button>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
          <button onClick={() => setTab('repairs')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'repairs' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>Repair Jobs</button>
          <button onClick={() => setTab('warranties')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'warranties' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>Warranties</button>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job card, IMEI, invoice..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>
      </div>

      {tab === 'repairs' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepairs.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 cursor-pointer hover:shadow-md" onClick={() => openDetail(r)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Wrench size={18} /></div>
                  <div>
                    <p className="font-semibold text-slate-800">{r.jobCardNumber}</p>
                    <p className="text-xs text-slate-400">{r.brand} {r.model}</p>
                  </div>
                </div>
                <Badge color={statusColor(r.status)}>{titleCase(r.status)}</Badge>
              </div>
              <p className="text-sm text-slate-600 mt-3">{r.customerName} · {r.customerPhone}</p>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.problemDescription}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-400">Received {formatDate(r.dateReceived)}</span>
                <span className="font-semibold text-slate-800">{formatKES(r.estimatedCost)}</span>
              </div>
            </div>
          ))}
          {filteredRepairs.length === 0 && <div className="col-span-full"><EmptyState icon={<Wrench size={26} />} title="No repair jobs found" /></div>}
        </div>
      )}

      {tab === 'warranties' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Serial/IMEI</th>
                <th className="text-left px-4 py-3">Expires</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredWarranties.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{w.productName}</td>
                  <td className="px-4 py-3">{w.customerName}</td>
                  <td className="px-4 py-3 text-slate-500">{w.invoiceNumber}</td>
                  <td className="px-4 py-3 text-slate-500">{w.serial || w.imei1 || '-'}</td>
                  <td className="px-4 py-3">{formatDate(w.expiryDate)}</td>
                  <td className="px-4 py-3"><Badge color={warrantyColor(w.warrantyStatus)}>{titleCase(w.warrantyStatus)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredWarranties.length === 0 && <EmptyState icon={<ShieldCheck size={26} />} title="No warranty records found" />}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log New Repair" wide>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Customer Name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <Input label="Customer Phone" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          <Select label="Device Type" value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })}>
            <option>Smartphone</option>
            <option>Laptop</option>
            <option>Tablet</option>
            <option>Desktop</option>
            <option>Printer</option>
            <option>Other</option>
          </Select>
          <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Input label="Serial / IMEI" value={form.serialOrImei} onChange={(e) => setForm({ ...form, serialOrImei: e.target.value })} />
          <Select label="Technician" value={form.technicianName} onChange={(e) => setForm({ ...form, technicianName: e.target.value })}>
            <option value="">Select technician</option>
            {technicians.map((t) => <option key={t.id} value={t.fullName}>{t.fullName}</option>)}
          </Select>
          <Input label="Estimated Cost (KES)" type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
          <Input label="Deposit Paid (KES)" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
          <Input label="Expected Completion Date" type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
        </div>
        <label className="block mt-3">
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Problem Description</span>
          <textarea value={form.problemDescription} onChange={(e) => setForm({ ...form, problemDescription: e.target.value })} rows={2} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
        </label>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={submitRepair}>Log Repair</Button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Job Card ${detail?.jobCardNumber || ''}`}>
        {detail && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-500">Customer: <span className="text-slate-800 font-medium">{detail.customerName} · {detail.customerPhone}</span></p>
            <p className="text-slate-500">Device: <span className="text-slate-800 font-medium">{detail.brand} {detail.model} ({detail.deviceType})</span></p>
            <p className="text-slate-500">Issue: <span className="text-slate-800">{detail.problemDescription}</span></p>
            {can('repairs_manage') && (
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <Select label="Status" value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
                  {STATUS_FLOW.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Final Cost (KES)" type="number" value={statusForm.finalCost} onChange={(e) => setStatusForm({ ...statusForm, finalCost: e.target.value })} />
                  <Input label="Deposit Paid (KES)" type="number" value={statusForm.deposit} onChange={(e) => setStatusForm({ ...statusForm, deposit: e.target.value })} />
                </div>
                <Button className="w-full" onClick={updateRepair}>Update Job Card</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
