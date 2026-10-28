'use client';

// ============================================
// page.tsx — корень SPA-панели AmneziaWG
// Вся навигация — внутреннее состояние (единый маршрут /)
// ============================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import LoginView from '@/components/panel/LoginView';
import Shell, { NAV, type ViewKey } from '@/components/panel/Shell';
import DashboardView from '@/components/panel/DashboardView';
import ClientsView from '@/components/panel/ClientsView';
import ServerView from '@/components/panel/ServerView';
import RoutingView from '@/components/panel/RoutingView';
import TelegramView from '@/components/panel/TelegramView';
import AdminsView from '@/components/panel/AdminsView';
import LogsView from '@/components/panel/LogsView';
import { api, type SessionUser, type PanelState, type Dashboard as DashboardData } from '@/lib/awg/client';

interface ToastItem { id: number; msg: string; type: 'success' | 'error' | 'info' }

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<ViewKey>('dashboard');
  const [state, setState] = useState<PanelState | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [demoHint, setDemoHint] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const loadState = useCallback(async () => {
    try { setState(await api<PanelState>('/api/state')); }
    catch (e) {
      if ((e as Error).message.includes('авториз') || (e as Error).message.includes('истекла')) {
        setUser(null);
      }
    }
  }, []);

  const loadDash = useCallback(async () => {
    try { setDash(await api<DashboardData>('/api/dashboard')); }
    catch { /* тихо — опрос */ }
  }, []);

  // Первичная проверка сессии
  useEffect(() => {
    void (async () => {
      try {
        const me = await api<{ user: SessionUser }>('/api/me');
        setUser(me.user);
        void loadState();
      } catch { setUser(null); }
      setAuthChecked(true);
    })();
    void fetch('/api/health').then((r) => r.json()).then((d: { demo?: boolean }) => setDemoHint(!!d.demo)).catch(() => {});
  }, []);

  // Если у ограниченного админа нет прав на текущий вид — используем доступный (без setState в эффекте)
  const allowedViews = user ? NAV.filter((n) => user.role === 'root' || user.perms.includes(n.perm)).map((n) => n.key) : [];
  const activeView: ViewKey = allowedViews.includes(view) ? view : (allowedViews[0] || 'dashboard');

  const changeView = useCallback((v: ViewKey) => {
    setView(v);
    if (v === 'dashboard') void loadDash();
  }, [loadDash]);

  // Опрос дашборда (без синхронного setState в теле эффекта)
  useEffect(() => {
    if (!user || activeView !== 'dashboard') return;
    const t = setInterval(() => void loadDash(), 4000);
    return () => clearInterval(t);
  }, [user, activeView, loadDash]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setState(null);
    setDash(null);
  }, []);

  const onLogin = useCallback((u: SessionUser) => {
    setUser(u);
    setView('dashboard');
    void loadState();
  }, [loadState]);

  // ---------- Экраны ----------
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="w-6 h-6 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={onLogin} demoHint={demoHint} />;
  }

  return (
    <>
      <Shell user={user} state={state} view={activeView} setView={changeView} onLogout={() => void logout()} onRefresh={() => { void loadState(); void loadDash(); toast('Данные обновлены', 'info'); }}>
        {activeView === 'dashboard' && <DashboardView data={dash} iface={state?.server?.iface || 'awg0'} />}
        {activeView === 'clients' && <ClientsView state={state} toast={toast} />}
        {activeView === 'server' && <ServerView state={state} setState={setState} toast={toast} />}
        {activeView === 'routing' && <RoutingView state={state} toast={toast} />}
        {activeView === 'telegram' && <TelegramView toast={toast} />}
        {activeView === 'admins' && <AdminsView user={user} onUser={setUser} toast={toast} />}
        {activeView === 'logs' && <LogsView toast={toast} />}
      </Shell>

      {/* Тосты */}
      <div className="fixed bottom-4 right-4 z-[70] space-y-2 pointer-events-none max-w-[calc(100vw-2rem)]" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md bg-slate-900/95 text-[13px] font-medium ${
              t.type === 'error' ? 'border-rose-500/40 text-rose-300' : t.type === 'info' ? 'border-cyan-500/40 text-cyan-300' : 'border-emerald-500/40 text-emerald-300'
            }`}>
            <span className="shrink-0 mt-0.5">{t.type === 'error' ? '⚠️' : t.type === 'info' ? 'ℹ️' : '✅'}</span>
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}
