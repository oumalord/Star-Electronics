import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, PackagePlus, PackageMinus, Barcode, Tag } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES } from '../lib/util';
import { Modal, Button, Badge, Input, Select, EmptyState, ConfirmDialog } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

const EMPTY_FORM = {
  name: '', sku: '', barcode: '', categoryId: '', brand: '', model: '', description: '',
  purchasePrice: '', sellingPrice: '', wholesalePrice: '', discountPrice: '', stock: '', minStock: '5',
  supplierId: '', warrantyMonths: '0', requiresSerial: false, requiresImei: false, icon: '📦',
};

export default function Products() {
  const { can } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [deviceModal, setDeviceModal] = useState<any | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [newDevice, setNewDevice] = useState({ serial: '', imei1: '', imei2: '', color: '' });

  const load = () => {
    apiClient.get('/api/products').then((res) => setProducts(res.data.products));
    apiClient.get('/api/categories').then((res) => setCategories(res.data.categories));
    apiClient.get('/api/suppliers').then((res) => setSuppliers(res.data.suppliers));
  };
  useEffect(load, []);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ ...p, purchasePrice: String(p.purchasePrice), sellingPrice: String(p.sellingPrice), wholesalePrice: String(p.wholesalePrice), discountPrice: String(p.discountPrice), stock: String(p.stock), minStock: String(p.minStock), warrantyMonths: String(p.warrantyMonths) });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.sku || !form.sellingPrice) {
      toast('Name, SKU and selling price are required.', 'error');
      return;
    }
    try {
      if (editing) {
        await apiClient.put(`/api/products/${editing.id}`, form);
        toast('Product updated successfully.', 'success');
      } else {
        await apiClient.post('/api/products', form);
        toast('Product added successfully.', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not save the product.', 'error');
    }
  };

  const remove = async (p: any) => {
    await apiClient.del(`/api/products/${p.id}`);
    toast('Product deleted.', 'success');
    load();
  };

  const adjustStock = async (p: any, delta: number) => {
    const reason = prompt(delta > 0 ? 'Reason for adding stock (e.g. stock take correction):' : 'Reason for removing stock (e.g. damaged item):') || 'manual adjustment';
    await apiClient.post(`/api/products/${p.id}/adjust-stock`, { delta, reason });
    toast('Stock adjusted.', 'success');
    load();
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    await apiClient.post('/api/categories', { name: newCat.trim() });
    setNewCat('');
    load();
  };

  const openDevices = async (p: any) => {
    setDeviceModal(p);
    const res = await apiClient.get('/api/devices', { productId: p.id });
    setDevices(res.data.devices);
  };
  const addDevice = async () => {
    if (!deviceModal) return;
    await apiClient.post('/api/devices', { productId: deviceModal.id, ...newDevice });
    setNewDevice({ serial: '', imei1: '', imei2: '', color: '' });
    const res = await apiClient.get('/api/devices', { productId: deviceModal.id });
    setDevices(res.data.devices);
    toast('Unit added.', 'success');
  };

  const canManage = can('products_manage');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products & Inventory</h1>
          <p className="text-sm text-slate-500">{products.length} products across {categories.length} categories</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCatModalOpen(true)}>
              <Tag size={16} /> Categories
            </Button>
            <Button onClick={openAdd}>
              <Plus size={16} /> Add Product
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, SKU or barcode..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white">
          <option value="all">All statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">SKU</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{p.icon}</span>
                      <div>
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.brand} {p.model}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatKES(p.sellingPrice)}</td>
                  <td className="px-4 py-3 text-right">{p.stock}</td>
                  <td className="px-4 py-3">
                    <Badge color={p.status === 'in_stock' ? 'green' : p.status === 'low_stock' ? 'amber' : p.status === 'out_of_stock' ? 'red' : 'slate'}>{p.status.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {(p.requiresSerial || p.requiresImei) && (
                        <button onClick={() => openDevices(p)} title="Manage serials/IMEI" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <Barcode size={15} />
                        </button>
                      )}
                      {can('stock_adjust') && (
                        <>
                          <button onClick={() => adjustStock(p, 1)} title="Add stock" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600">
                            <PackagePlus size={15} />
                          </button>
                          <button onClick={() => adjustStock(p, -1)} title="Remove stock" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                            <PackageMinus size={15} />
                          </button>
                        </>
                      )}
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-[#2563eb]">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={<Search size={26} />} title="No products found" sub="Try a different search or add a new product" />}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} wide>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <Input label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <Select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Input label="Purchase Price (KES)" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          <Input label="Selling Price (KES)" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          <Input label="Wholesale Price (KES)" type="number" value={form.wholesalePrice} onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })} />
          <Input label="Discount Price (KES)" type="number" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} />
          <Input label="Current Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <Input label="Minimum Stock Level" type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          <Select label="Supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Warranty (months)" type="number" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} />
          <Input label="Icon (emoji)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.requiresSerial} onChange={(e) => setForm({ ...form, requiresSerial: e.target.checked })} /> Requires Serial No.
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.requiresImei} onChange={(e) => setForm({ ...form, requiresImei: e.target.checked })} /> Requires IMEI
            </label>
          </div>
        </div>
        <label className="block mt-3">
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
        </label>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Save Changes' : 'Add Product'}</Button>
        </div>
      </Modal>

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="Manage Categories">
        <div className="flex gap-2 mb-4">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" />
          <Button onClick={addCategory}><Plus size={16} /></Button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
              <span>{c.name}</span>
              <button onClick={async () => { await apiClient.del(`/api/categories/${c.id}`); load(); }} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={!!deviceModal} onClose={() => setDeviceModal(null)} title={`Serials / IMEI — ${deviceModal?.name || ''}`} wide>
        <div className="grid sm:grid-cols-4 gap-2 mb-4">
          <Input placeholder="Serial Number" value={newDevice.serial} onChange={(e) => setNewDevice({ ...newDevice, serial: e.target.value })} />
          <Input placeholder="IMEI 1" value={newDevice.imei1} onChange={(e) => setNewDevice({ ...newDevice, imei1: e.target.value })} />
          <Input placeholder="IMEI 2" value={newDevice.imei2} onChange={(e) => setNewDevice({ ...newDevice, imei2: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="Color" value={newDevice.color} onChange={(e) => setNewDevice({ ...newDevice, color: e.target.value })} />
            <Button onClick={addDevice}><Plus size={16} /></Button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
              <span>{d.serial && `SN: ${d.serial}`} {d.imei1 && `IMEI: ${d.imei1}`} {d.color && `· ${d.color}`}</span>
              <Badge color={d.status === 'in_stock' ? 'green' : 'slate'}>{d.status.replace('_', ' ')}</Badge>
            </div>
          ))}
          {devices.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No units recorded yet</p>}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove(deleteTarget)} title="Delete Product" message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`} danger />
    </div>
  );
}
