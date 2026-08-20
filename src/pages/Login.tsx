import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Lock, User, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/context';

const DEMO = [{ role: 'Owner', username: 'Admin', pin: '2114' }];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const res = await login(username.trim(), pin.trim());
    setLoading(false);
    if (res.ok) navigate('/');
    else setErrorMsg(res.message || 'Invalid username or PIN.');
  };

  return (
    <div className="min-h-screen bg-[#08111f] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      <video autoPlay muted loop playsInline poster="https://i.pinimg.com/736x/14/bf/a0/14bfa0049ff9aee54b6801a62caa1180.jpg" className="absolute inset-0 h-full w-full object-cover opacity-55" aria-hidden="true">
        <source src="https://v1.pinimg.com/videos/iht/hls/3f/7d/ea/3f7dea7cfe9452a402d069e99b57cc9a_540w.cmfv" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[#08111f]/65" />
      <div className="relative w-full max-w-4xl grid lg:grid-cols-2 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl">
        <div className="hidden lg:flex flex-col justify-between bg-[#0b1526]/70 backdrop-blur-sm p-10 text-white">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] flex items-center justify-center shadow-lg">
                <Star className="text-[#0b1526]" size={24} fill="#0b1526" />
              </div>
              <p className="font-extrabold text-2xl tracking-tight">
                STAR<span className="text-[#fbbf24]">ELECTRONICS</span>
              </p>
            </div>
            <p className="mt-4 text-blue-100 text-sm max-w-xs">Smart Technology. Trusted Service.</p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-blue-100 uppercase tracking-wide">All-in-one shop platform</p>
            <ul className="space-y-2 text-sm text-blue-50">
              <li>⚡ Lightning-fast Point of Sale</li>
              <li>📦 Real-time inventory & serial/IMEI tracking</li>
              <li>💳 M-Pesa STK Push payments</li>
              <li>🔧 Repairs, warranties & customer CRM</li>
            </ul>
          </div>
          <p className="text-xs text-blue-200/70">© {new Date().getFullYear()} Star Electronics, Nairobi, Kenya</p>
        </div>

        <div className="bg-white/95 backdrop-blur p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] flex items-center justify-center">
              <Star className="text-[#0b1526]" size={20} fill="#0b1526" />
            </div>
            <p className="font-extrabold text-lg text-slate-900">STAR ELECTRONICS</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in to your Star Electronics workstation</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb]" placeholder="e.g. admin" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} required className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb]" placeholder="4-digit PIN" />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" /> Remember me
              </label>
              <button type="button" className="text-[#2563eb] font-medium hover:underline" onClick={() => alert('Please contact your Star Electronics system administrator to reset your PIN.')}>
                Forgot PIN?
              </button>
            </div>
            {errorMsg && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1e40af] to-[#2563eb] text-white font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : null} Sign In
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Owner Account</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.username}
                  type="button"
                  onClick={() => {
                    setUsername(d.username);
                    setPin(d.pin);
                  }}
                  className="text-left px-2.5 py-1.5 rounded-lg border border-slate-100 hover:border-[#2563eb]/40 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-xs font-semibold text-slate-700">{d.role}</p>
                  <p className="text-[10px] text-slate-400">{d.username} · PIN {d.pin}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Create additional staff accounts from Staff &amp; Commissions once signed in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
