import { useEffect, useState } from 'react';
import { Plus, Wallet, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDate, titleCase } from '../lib/util';
import { Modal, Button, Badge, Input, Select, EmptyState } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

const CATEGORIES = ['Rent', 'Electricity', 'Internet', 'Transport', 'Salaries', 'Marketing', 'Repairs', 'Supplies', 'Miscellaneous'];
const EMPTY = { category: 'Rent', description: '', amount: '', paymentMethod: 'cash', reference: '', notes: '' };

export default function Expenses() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);

  const load = () => apiClient.get('/api/expenses').then((res) => setExpenses(res.data.expenses));
  useEffect(() => { load(); }, []);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const save = async () => {
    if (!form.category || !form.amount) return toast('Category and amount are required.', 'error');
    await apiClient.post('/api/expenses', form);
    toast('Expense recorded.', 'success');
    setModalOpen(false);
    setForm(EMPTY);
    load();
  };

  const remove = async (e: any) => {
    if (!confirm('Delete this expense record?')) return;
    await apiClient.del(`/api/expenses/${e.id}`);
    load();
  };

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500">Total recorded: <span className="font-semibold text-slate-700">{formatKES(total)}</span></p>
        </div>
        {can('expenses_manage') && <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto"><Plus size={16} /> Record Expense</Button>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-left px-4 py-3">Recorded By</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">{formatDate(e.date)}</td>
                <td className="px-4 py-3"><Badge color="blue">{e.category}</Badge></td>
                <td className="px-4 py-3 text-slate-600">{e.description || '-'}</td>
                <td className="px-4 py-3 text-slate-500">{e.staffName}</td>
                <td className="px-4 py-3 text-slate-500">{titleCase(e.paymentMethod)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatKES(e.amount)}</td>
                <td className="px-4 py-3 text-right">
                  {can('expenses_manage') && <button onClick={() => remove(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="md:hidden divide-y divide-slate-100">
          {expenses.map((e) => (
            <div key={e.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-800 truncate">{e.description || e.category}</p><p className="text-xs text-slate-500">{formatDate(e.date)} · {e.staffName}</p></div><p className="font-bold text-slate-900 whitespace-nowrap">{formatKES(e.amount)}</p></div>
              <div className="flex flex-wrap items-center gap-2"><Badge color="blue">{e.category}</Badge><span className="text-xs text-slate-500">{titleCase(e.paymentMethod)}</span>{can('expenses_manage') && <button onClick={() => remove(e)} className="ml-auto p-1.5 rounded-lg hover:bg-red-50 text-red-500" aria-label="Delete expense"><Trash2 size={14} /></button>}</div>
            </div>
          ))}
        </div>
        {expenses.length === 0 && <EmptyState icon={<Wallet size={26} />} title="No expenses recorded yet" />}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Expense">
        <div className="grid sm:grid-cols-2 gap-3">
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Amount (KES)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select label="Payment Method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
          </Select>
          <Input label="Reference / Receipt No." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </div>
        <div className="mt-3">
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={save} className="w-full sm:w-auto">Save Expense</Button>
        </div>
      </Modal>
    </div>
  );
}
