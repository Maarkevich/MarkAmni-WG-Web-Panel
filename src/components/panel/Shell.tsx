'use client';

// ============================================
// Shell.tsx — каркас: сайдбар (десктоп) + верхняя панель и меню (мобильные)
// ============================================
import { useState, type ReactNode } from 'react';
import {
  Shield, LayoutDashboard, Users, Server, Globe, Send, UserCog, ScrollText, Link,
  Menu, X, LogOut, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import { Badge } from './bits';
import type { PanelState, SessionUser } from '@/lib/awg/client';

export type ViewKey = 'dashboard' | 'clients' | 'server' | 'routing' | 'domain' | 'telegram' | 'admins' | 'logs';

export const NAV: { key: ViewKey; label: string; icon: ReactNode; perm: string }[] = [
  { key: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard className="w-[18px] h-[18px]" />, perm: 'dashboard' },
  { key: 'clients', label: 'Клиенты', icon: <Users className="w-[18px] h-[18px]" />, perm: 'clients' },
  { key: 'server', label: 'Сервер', icon: <Server className="w-[18px] h-[18px]" />, perm: 'server' },
  { key: 'routing', label: 'Маршрутизация', icon: <Globe className="w-[18px] h-[18px]" />, perm: 'routing' },
  { key: 'domain', label: 'Домен', icon: <Link className="w-[18px] h-[18px]" />, perm: 'server' },
  { key: 'telegram', label: 'Telegram', icon: <Send className="w-[18px] h-[18px]" />, perm: 'telegram' },
  { key: 'admins', label: 'Администраторы', icon: <UserCog className="w-[18px] h-[18px]" />, perm: 'admins' },
  { key: 'logs', label: 'Журнал', icon: <ScrollText className="w-[18px] h-[18px]" />, perm: 'logs' }
];

function NavList({ items, view, setView, onNav }: {
  items: typeof NAV;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  onNav?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2" aria-label="Разделы панели">
      {items.map((n) => (
        <button
          key={n.key}
          onClick={() => { setView(n.key); onNav?.(); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
            view === n.key
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
          }`}
        >
          <span className={view === n.key ? 'text-emerald-400' : 'text-slate-500'}>{n.icon}</span>
          {n.label}
        </button>
      ))}
    </nav>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 shrink-0 border-b border-slate-800/70">
      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <Shield className="w-[18px] h-[18px] text-emerald-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-100 leading-tight">AmneziaWG</p>
        <p className="text-[10px] text-slate-500 leading-tight">Панель управления</p>
      </div>
    </div>
  );
}

export default function Shell({ user, state, view, setView, onLogout, onRefresh, children }: {
  user: SessionUser;
  state: PanelState | null;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  onLogout: () => void;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => user.role === 'root' || user.perms.includes(n.perm));
  const ifaceUp = state?.runtime?.ifaceUp;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ===== Сайдбар (десктоп) ===== */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-slate-800 bg-slate-900/40 sticky top-0 h-screen">
        <Logo />
        <NavList items={items} view={view} setView={setView} />
        <div className="p-3 border-t border-slate-800/70 space-y-2">
          <div className="flex items-center gap-2 px-2">
            {ifaceUp ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-slate-500" />}
            <div className="min-w-0">
              <p className="text-[11px] text-slate-300 font-medium truncate">{state?.server?.iface || 'awg0'}</p>
              <p className="text-[10px] text-slate-500">{ifaceUp ? 'интерфейс активен' : 'остановлен'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2">
            <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[11px] font-bold text-emerald-300 uppercase shrink-0">
              {user.username.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-200 font-medium truncate">{user.username}</p>
              <p className="text-[10px] text-slate-500">{user.role === 'root' ? 'главный админ' : 'администратор'}</p>
            </div>
            <button onClick={onLogout} title="Выйти"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-slate-800 transition-colors" aria-label="Выйти">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Мобильное меню ===== */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            <div className="flex items-center justify-between pr-2">
              <Logo />
              <button onClick={() => setOpen(false)} className="p-2 text-slate-500" aria-label="Закрыть меню"><X className="w-5 h-5" /></button>
            </div>
            <NavList items={items} view={view} setView={setView} onNav={() => setOpen(false)} />
            <div className="p-3 border-t border-slate-800">
              <button onClick={() => { setOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] text-rose-300 hover:bg-rose-500/10 transition-colors">
                <LogOut className="w-4 h-4" /> Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Контент ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Мобильный хедер */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-3 bg-slate-950/90 backdrop-blur border-b border-slate-800">
          <button onClick={() => setOpen(true)} className="p-2 -ml-1 text-slate-300" aria-label="Меню"><Menu className="w-5 h-5" /></button>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <h1 className="text-[13px] font-bold text-slate-100 truncate">{NAV.find((n) => n.key === view)?.label}</h1>
          <div className="ml-auto flex items-center gap-2">
            {state?.runtime?.demo && <Badge tone="amber">Демо</Badge>}
            <button onClick={onRefresh} className="p-2 text-slate-400 hover:text-slate-200" aria-label="Обновить">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Десктопный хедер */}
        <header className="hidden lg:flex sticky top-0 z-30 items-center gap-3 h-14 px-6 bg-slate-950/90 backdrop-blur border-b border-slate-800">
          <h1 className="text-sm font-bold text-slate-100">{NAV.find((n) => n.key === view)?.label}</h1>
          {state?.runtime?.demo && <Badge tone="amber">Режим конфигуратора (AWG не установлен)</Badge>}
          {!state?.runtime?.demo && (
            <Badge tone={ifaceUp ? 'green' : 'red'}>{ifaceUp ? `${state?.server?.iface} активен` : `${state?.server?.iface} остановлен`}</Badge>
          )}
          <div className="ml-auto text-[11px] text-slate-500 font-mono">
            {state?.server?.endpoint ? `${state.server.endpoint}:${state.server.port}` : ''}
          </div>
          <button onClick={onRefresh} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors" aria-label="Обновить">
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
