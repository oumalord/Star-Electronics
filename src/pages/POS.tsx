import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, User, Smartphone, Wallet, CreditCard, Landmark, Loader2, Printer, CheckCircle2, X } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatKES, formatDateTime } from '../lib/util';
import { Modal, Button, Badge, Input, EmptyState } from '../components/UI';
import { useAuth, useToast } from '../lib/context';

interface CartLine {
  productId: string;
  name: string;
  icon: string;
  qty: number;
  unitPrice: number;
  stock: number;
  requiresSerial: boolean;
  requiresImei: boolean;
  deviceUnitId?: string;
  serial?: string;
}

type PayMethod = 'cash' | 'mpesa' | 'card' | 'bank_transfer';

export default function POS() {
  const { staff } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cash');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [amountTendered, setAmountTendered] = useState<number | ''>('');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [mpesaModal, setMpesaModal] = useState<{ status: string; sale: any } | null>(null);
  const [deviceModal, setDeviceModal] = useState<{ product: any; devices: any[] } | null>(null);

  const load = () => {
    apiClient.get('/api/products').then((res) => setProducts(res.data.products));
    apiClient.get('/api/categories').then((res) => setCategories(res.data.categories));
    apiClient.get('/api/customers').then((res) => setCustomers(res.data.customers));
  };
  useEffect(load, []);

  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCategory === 'all' || p.categoryId === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    return matchesCat && matchesSearch;
  });

  const addToCart = async (product: any) => {
    if (product.stock <= 0) {
      toast('This product is out of stock.', 'error');
      return;
    }
    if (product.requiresSerial || product.requiresImei) {
      const res = await apiClient.get('/api/devices', { productId: product.id, status: 'in_stock' });
      if (res.data.devices.length === 0) {
        toast('No available serial/IMEI units for this product.', 'error');
        return;
      }
      setDeviceModal({ product, devices: res.data.devices });
      return;
    }
    setCart((c) => {
      const existing = c.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast('Not enough stock available.', 'error');
          return c;
        }
        return c.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { productId: product.id, name: product.name, icon: product.icon, qty: 1, unitPrice: product.sellingPrice, stock: product.stock, requiresSerial: product.requiresSerial, requiresImei: product.requiresImei }];
    });
  };

  const addDeviceToCart = (device: any) => {
    if (!deviceModal) return;
    const product = deviceModal.product;
    setCart((c) => [...c, { productId: product.id, name: product.name, icon: product.icon, qty: 1, unitPrice: product.sellingPrice, stock: product.stock, requiresSerial: product.requiresSerial, requiresImei: product.requiresImei, deviceUnitId: device.id, serial: device.serial || device.imei1 }]);
    setDeviceModal(null);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((c) =>
      c
        .map((l) => {
          if (l.productId !== productId || l.deviceUnitId) return l;
          const newQty = l.qty + delta;
          if (newQty < 1) return l;
          if (newQty > l.stock) {
            toast('Not enough stock available.', 'error');
            return l;
          }
          return { ...l, qty: newQty };
        })
        .filter((l) => l.qty > 0)
    );
  };

  const removeLine = (productId: string, deviceUnitId?: string) => setCart((c) => c.filter((l) => !(l.productId === productId && l.deviceUnitId === deviceUnitId)));

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.qty * l.unitPrice, 0), [cart]);
  const total = Math.max(0, subtotal - discount);
  const change = paymentMethod === 'cash' && amountTendered !== '' ? Math.max(0, Number(amountTendered) - total) : 0;

  const filteredCustomers = customers.filter((c) => c.fullName.toLowerCase().includes(customerQuery.toLowerCase()) || c.phone.includes(customerQuery));
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const resetSale = () => {
    setCart([]);
    setCustomerId('');
    setCustomerQuery('');
    setDiscount(0);
    setPaymentMethod('cash');
    setMpesaPhone('');
    setAmountTendered('');
    load();
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast('Cart is empty.', 'error');
      return;
    }
    if (paymentMethod === 'mpesa' && !mpesaPhone) {
      toast('Enter the customer M-Pesa phone number.', 'error');
      return;
    }
    setProcessing(true);
    try {
      const res = await apiClient.post('/api/sales', {
        customerId,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, discount: 0, deviceUnitId: l.deviceUnitId })),
        discountTotal: discount,
        paymentMethod,
        mpesaPhone: mpesaPhone.replace(/^0/, '254'),
      });
      if (paymentMethod === 'mpesa' && res.data.mpesaTransaction) {
        setMpesaModal({ status: 'pending', sale: res.data.sale });
        pollMpesa(res.data.mpesaTransaction.checkoutRequestId);
      } else {
        setReceipt(res.data.sale);
        resetSale();
        toast('Sale completed successfully!', 'success');
      }
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not complete the sale.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const pollMpesa = (checkoutRequestId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await apiClient.get(`/api/mpesa/status/${checkoutRequestId}`);
        const txn = res.data.transaction;
        if (txn.status === 'successful') {
          clearInterval(interval);
          setMpesaModal(null);
          setReceipt(res.data.sale);
          resetSale();
          toast('M-Pesa payment received successfully!', 'success');
        } else if (txn.status === 'failed' || txn.status === 'cancelled' || txn.status === 'timeout') {
          clearInterval(interval);
          setMpesaModal({ status: txn.status, sale: res.data.sale });
        }
      } catch {
        // transient network/API hiccup - keep polling until the attempt cap is hit
      }
      if (attempts >= 20) clearInterval(interval);
    }, 2000);
  };

  const paymentOptions: { k: PayMethod; label: string; icon: typeof Wallet }[] = [
    { k: 'cash', label: 'Cash', icon: Wallet },
    { k: 'mpesa', label: 'M-Pesa', icon: Smartphone },
    { k: 'card', label: 'Card', icon: CreditCard },
    { k: 'bank_transfer', label: 'Bank', icon: Landmark },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products, SKU or scan barcode..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30" autoFocus />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveCategory('all')} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${activeCategory === 'all' ? 'bg-[#1e40af] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            All
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${activeCategory === c.id ? 'bg-[#1e40af] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {filteredProducts.map((p) => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0} className="bg-white rounded-2xl border border-slate-100 p-3.5 text-left hover:border-[#2563eb]/40 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-2xl mb-2">{p.icon}</div>
              <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight">{p.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.sku}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-[#1e40af]">{formatKES(p.sellingPrice)}</span>
                <Badge color={p.stock <= 0 ? 'red' : p.stock <= p.minStock ? 'amber' : 'green'}>{p.stock}</Badge>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={<Search size={26} />} title="No products found" sub="Try a different search term or category" />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-fit lg:sticky lg:top-20 max-h-[85vh]">
        <div className="p-4 border-b border-slate-100">
          <p className="font-bold text-slate-900">Current Sale</p>
          <div className="relative mt-2">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={selectedCustomer ? selectedCustomer.fullName : customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId('');
              }}
              placeholder="Walk-in Customer (search to select)"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            {customerQuery && !customerId && filteredCustomers.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                {filteredCustomers.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerQuery('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                  >
                    {c.fullName} <span className="text-slate-400">· {c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 && <EmptyState icon={<Wallet size={24} />} title="Cart is empty" sub="Tap a product to add it" />}
          {cart.map((l) => (
            <div key={l.productId + (l.deviceUnitId || '')} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
              <span className="text-xl">{l.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{l.name}</p>
                {l.serial && <p className="text-[10px] text-slate-400">SN/IMEI: {l.serial}</p>}
                <p className="text-xs text-slate-500">{formatKES(l.unitPrice)} each</p>
              </div>
              {!l.deviceUnitId && (
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(l.productId, -1)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                  <button onClick={() => updateQty(l.productId, 1)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                    <Plus size={12} />
                  </button>
                </div>
              )}
              <button onClick={() => removeLine(l.productId, l.deviceUnitId)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{formatKES(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Discount (KES)</span>
            <input type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} className="w-24 text-right rounded-lg border border-slate-200 px-2 py-1" />
          </div>
          <div className="flex items-center justify-between font-bold text-lg text-slate-900 pt-1 border-t border-dashed border-slate-200">
            <span>Total</span>
            <span>{formatKES(total)}</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {paymentOptions.map((m) => (
              <button key={m.k} onClick={() => setPaymentMethod(m.k)} className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[11px] font-semibold ${paymentMethod === m.k ? 'bg-[#1e40af] text-white border-[#1e40af]' : 'bg-white text-slate-500 border-slate-200'}`}>
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'mpesa' && <Input label="M-Pesa Phone Number" placeholder="07XX XXX XXX" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} />}
          {paymentMethod === 'cash' && (
            <div>
              <Input label="Amount Tendered (KES)" type="number" value={amountTendered} onChange={(e) => setAmountTendered(e.target.value === '' ? '' : Number(e.target.value))} />
              {amountTendered !== '' && <p className="text-xs text-emerald-600 font-semibold mt-1">Change due: {formatKES(change)}</p>}
            </div>
          )}

          <Button onClick={completeSale} disabled={processing || cart.length === 0} className="w-full">
            {processing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Complete Sale
          </Button>
          <p className="text-[10px] text-slate-400 text-center">Cashier: {staff?.fullName}</p>
        </div>
      </div>

      <Modal open={!!deviceModal} onClose={() => setDeviceModal(null)} title={`Select unit — ${deviceModal?.product.name || ''}`}>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {deviceModal?.devices.map((d) => (
            <button key={d.id} onClick={() => addDeviceToCart(d)} className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-[#2563eb] hover:bg-blue-50 text-sm">
              {d.serial && <span className="font-medium">SN: {d.serial}</span>}
              {d.imei1 && <span className="font-medium ml-2">IMEI: {d.imei1}</span>}
              {d.color && <span className="text-slate-400 ml-2">· {d.color}</span>}
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={!!mpesaModal} onClose={() => setMpesaModal(null)} title="M-Pesa STK Push">
        {mpesaModal?.status === 'pending' && (
          <div className="text-center py-6">
            <Loader2 className="animate-spin mx-auto text-[#2563eb]" size={40} />
            <p className="mt-4 font-semibold text-slate-800">Waiting for customer to enter M-Pesa PIN...</p>
            <p className="text-sm text-slate-500 mt-1">A payment prompt has been sent to {mpesaPhone}</p>
            <p className="text-xs text-slate-400 mt-3">Total: {formatKES(mpesaModal.sale?.total || 0)}</p>
          </div>
        )}
        {mpesaModal && mpesaModal.status !== 'pending' && (
          <div className="text-center py-6">
            <X className="mx-auto text-red-500" size={40} />
            <p className="mt-4 font-semibold text-slate-800">Payment {mpesaModal.status}</p>
            <p className="text-sm text-slate-500 mt-1">The customer did not complete the M-Pesa payment. You can retry or choose a different payment method.</p>
            <Button className="mt-4" onClick={() => setMpesaModal(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function ReceiptModal({ receipt, onClose }: { receipt: any; onClose: () => void }) {
  if (!receipt) return null;
  return (
    <Modal open={!!receipt} onClose={onClose} title="Sale Complete">
      <div className="font-mono text-xs text-slate-800 space-y-1">
        <p className="text-center font-bold text-sm">STAR ELECTRONICS</p>
        <p className="text-center text-[10px] text-slate-500">Smart Technology. Trusted Service.</p>
        <p className="text-center text-[10px] text-slate-500">Moi Avenue, Nairobi · 0700 123 456</p>
        <div className="border-t border-dashed border-slate-300 my-2" />
        <p>Invoice: {receipt.invoiceNumber}</p>
        <p>Date: {formatDateTime(receipt.date)}</p>
        <p>Cashier: {receipt.staffName}</p>
        <p>Customer: {receipt.customerName}</p>
        <div className="border-t border-dashed border-slate-300 my-2" />
        {receipt.items.map((it: any, i: number) => (
          <div key={i} className="flex justify-between">
            <span>
              {it.qty}x {it.productName}
            </span>
            <span>{formatKES(it.total)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-slate-300 my-2" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatKES(receipt.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span>-{formatKES(receipt.discountTotal)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatKES(receipt.total)}</span>
        </div>
        <p className="mt-1">Payment: {receipt.paymentMethod.toUpperCase()}</p>
        <div className="border-t border-dashed border-slate-300 my-2" />
        <p className="text-center">Thank you for shopping with Star Electronics!</p>
        <p className="text-center text-[10px] text-slate-400">Warranty applies as per product terms.</p>
      </div>
      <div className="flex gap-2 mt-5">
        <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
        <Button className="flex-1" onClick={onClose}>
          New Sale
        </Button>
      </div>
    </Modal>
  );
}
