import { useEffect, useState } from 'react';
import { Plus, UserCog, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDate, titleCase } from '../lib/util';
import { Modal, Button, Badge, Input, Select, EmptyState } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

const ROLES = ['owner', 'manager', 'sales', 'inventory', 'technician', 'accountant'];
const EMPTY = { fullName: '', username: '', pin: '', role: 'sales', phone: '', email: '', commissionPercent: '0' };

export default function StaffCommissions() {
  const { can, staff: me } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'staff' | 'commissions'>('staff');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [commissionRows, setCommissionRows] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = () => {
    apiClient.get('/api/staff').then((res) => setStaffList(res.data.staff)).catch(() => {});
    apiClient.get('/api/reports', { type: 'staff' }).then((res) => setCommissionRows(res.data.rows)).catch(() => {});
  };
  useEffect(load, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ ...s, pin: '', commissionPercent: String(s.commissionPercent) }); setModalOpen(true); };

  const save = async () => {
    if (!form.fullName || !form.username || (!editing && !form.pin) || !form.role) return toast('Full name, username, role and PIN are required.', 'error');
    try {
      if (editing) await apiClient.put(`/api/staff/${editing.id}`, form);
      else await apiClient.post('/api/staff', form);
      toast('Staff member saved.', 'success');
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not save staff member.', 'error');
    }
  };

  const toggleStatus = async (s: any) => {
    await apiClient.put(`/api/staff/${s.id}`, { status: s.status === 'active' ? 'inactive' : 'active' });
    load();
  };

  const remove = async (s: any) => {
    if (s.id === me?.id) return toast('You cannot remove your own account.', 'error');
    if (!confirm(`Remove staff member "${s.fullName}"?`)) return;
    await apiClient.del(`/api/staff/${s.id}`);
    load();
  };

  const roleColor = (r: string): 'purple' | 'blue' | 'amber' | 'slate' => (r === 'owner' ? 'purple' : r === 'manager' ? 'blue' : r === 'accountant' ? 'amber' : 'slate');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff & Commissions</h1>
          <p className="text-sm text-slate-500">{staffList.length} team members</p>
        </div>
        {can('staff_manage') && <Button onClick={openAdd}><Plus size={16} /> Add Staff</Button>}
      </div>

      <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button onClick={() => setTab('staff')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'staff' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>Staff</button>
        <button onClick={() => setTab('commissions')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'commissions' ? 'bg-[#1e40af] text-white' : 'text-slate-500'}`}>Commissions</button>
      </div>

      {tab === 'staff' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e40af] to-[#2563eb] flex items-center justify-center text-white font-bold">{s.fullName.charAt(0)}</div>
                  <div>
                    <p className="font-semibold text-slate-800">{s.fullName}</p>
                    <Badge color={roleColor(s.role)}>{titleCase(s.role)}</Badge>
                  </div>
                </div>
                {can('staff_manage') && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                    <button onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-3">@{s.username} · {s.phone}</p>
              <p className="text-xs text-slate-400">Joined {formatDate(s.dateJoined)}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                {can('staff_manage') ? (
                  <button onClick={() => toggleStatus(s)}>
                    <Badge color={s.status === 'active' ? 'green' : 'red'}>{titleCase(s.status)}</Badge>
                  </button>
                ) : (
                  <Badge color={s.status === 'active' ? 'green' : 'red'}>{titleCase(s.status)}</Badge>
                )}
                <span className="text-xs text-slate-400">Commission: {s.commissionPercent}%</span>
              </div>
            </div>
          ))}
          {staffList.length === 0 && <div className="col-span-full"><EmptyState icon={<UserCog size={26} />} title="No staff members found" /></div>}
        </div>
      )}

      {tab === 'commissions' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Staff</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-right px-4 py-3">Sales Made</th>
                <th className="text-right px-4 py-3">Revenue Generated</th>
                <th className="text-right px-4 py-3">Discounts Given</th>
                <th className="text-right px-4 py-3">Commission Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {commissionRows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3"><Badge>{titleCase(r.role)}</Badge></td>
                  <td className="px-4 py-3 text-right">{r.salesCount}</td>
                  <td className="px-4 py-3 text-right">{formatKES(r.revenue)}</td>
                  <td className="px-4 py-3 text-right">{formatKES(r.discounts)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600 flex items-center justify-end gap-1"><TrendingUp size={13} /> {formatKES(r.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissionRows.length === 0 && <EmptyState icon={<TrendingUp size={26} />} title="No commission data yet" />}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Staff Member' : 'Add Staff Member'}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editing} />
          <Input label={editing ? 'New PIN (leave blank to keep)' : 'PIN'} type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
          </Select>
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Commission (%)" type="number" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
