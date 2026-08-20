import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/util';

export function StatCard({ label, value, icon, accent = 'blue', sub }: { label: string; value: string; icon: ReactNode; accent?: 'blue' | 'gold' | 'green' | 'red' | 'dark'; sub?: string }) {
  const accents: Record<string, string> = {
    blue: 'from-[#1e40af] to-[#2563eb]',
    gold: 'from-[#b45309] to-[#f59e0b]',
    green: 'from-emerald-600 to-emerald-500',
    red: 'from-red-600 to-red-500',
    dark: 'from-slate-800 to-slate-700',
  };
  return (
    <div className="bg-white rounded-[22px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)] border border-slate-100/80 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_32px_-12px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
          <p className="text-[26px] font-bold text-slate-900 mt-1 truncate tracking-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={cx('w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br shrink-0 shadow-inner', accents[accent])}>{icon}</div>
      </div>
    </div>
  );
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'purple' }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return <span className={cx('px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', colors[color])}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md" onClick={onClose}>
      <div className={cx('bg-white/95 backdrop-blur-xl rounded-[26px] shadow-[0_24px_70px_-16px_rgba(15,23,42,0.35)] w-full max-h-[90vh] overflow-y-auto border border-white/60', wide ? 'max-w-3xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-xl rounded-t-[26px] z-10">
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, className, size = 'md' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'gold' | 'ghost'; type?: 'button' | 'submit'; disabled?: boolean; className?: string; size?: 'sm' | 'md' }) {
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-b from-[#2563eb] to-[#1e40af] text-white shadow-[0_1px_2px_rgba(30,64,175,0.3),0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:shadow-[0_1px_2px_rgba(30,64,175,0.3),0_12px_28px_-6px_rgba(37,99,235,0.6)] hover:-translate-y-px active:translate-y-0',
    secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:border-slate-300 hover:bg-slate-50',
    danger: 'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_1px_2px_rgba(220,38,38,0.3),0_8px_20px_-6px_rgba(220,38,38,0.5)] hover:shadow-[0_1px_2px_rgba(220,38,38,0.3),0_12px_28px_-6px_rgba(220,38,38,0.6)] hover:-translate-y-px',
    gold: 'bg-gradient-to-b from-[#fbbf24] to-[#b45309] text-white shadow-[0_1px_2px_rgba(180,83,9,0.3),0_8px_20px_-6px_rgba(180,83,9,0.5)] hover:-translate-y-px',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cx('rounded-full font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0', size === 'sm' ? 'px-3.5 py-1.5 text-sm' : 'px-5 py-2.5 text-sm', variants[variant], className)}>
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</span>}
      <input {...rest} className={cx('w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb]', className)} />
    </label>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; children: ReactNode }) {
  const { label, className, children, ...rest } = props;
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</span>}
      <select {...rest} className={cx('w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] bg-white', className)}>
        {children}
      </select>
    </label>
  );
}

export function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">{icon}</div>
      <p className="font-semibold text-slate-700">{title}</p>
      {sub && <p className="text-sm text-slate-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse bg-slate-200 rounded-lg', className)} />;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  );
}
