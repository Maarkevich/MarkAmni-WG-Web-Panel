'use client';

// ============================================
// bits.tsx — общие UI-элементы панели
// ============================================
import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

export function CardHead({ title, icon, right, sub }: { title: string; icon?: ReactNode; right?: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-800">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-emerald-400 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 truncate">{title}</h3>
          {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Btn({ children, onClick, variant = 'ghost', className = '', type = 'button', disabled, title }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    primary: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold border-transparent',
    ghost: 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-200',
    subtle: 'bg-slate-800/60 hover:bg-slate-700 border-transparent text-slate-300',
    danger: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 outline-none focus:border-emerald-500/60 transition-colors';

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-slate-950 transition-all ${on ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
  );
}

export function CopyBtn({ text, label, className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-950/70 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors ${className}`}
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {label ?? 'Копировать'}
    </button>
  );
}

export function StatusDot({ on }: { on: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${on ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.8)]' : 'bg-slate-600'}`} />
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'cyan' }) {
  const tones = {
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    red: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${tones}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl`}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-3.5 bg-slate-900/95 backdrop-blur border-b border-slate-800 z-10">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors" aria-label="Закрыть">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500 mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block w-4 h-4 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin ${className}`} />
  );
}
