'use client';

// ============================================
// LoginView.tsx — экран входа
// ============================================
import { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { Btn, Field, inputCls } from './bits';
import { api, type SessionUser } from '@/lib/awg/client';

export default function LoginView({ onLogin, demoHint }: { onLogin: (u: SessionUser) => void; demoHint: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ user: SessionUser }>('/api/auth/login', { json: { username, password } });
      onLogin(res.user);
    } catch (e) {
      setError((e as Error).message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* фоновые пятна */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full max-w-sm relative ${shake ? 'animate-[shake_.5s]' : ''}`}>
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-7 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
              <Shield className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-slate-100">AmneziaWG Panel</h1>
            <p className="text-xs text-slate-500 mt-1">AWG 1.5 / 2.0 / 3.1 — управление конфигами</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
            <Field label="Логин">
              <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" autoComplete="username" autoFocus />
            </Field>
            <Field label="Пароль">
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" />
            </Field>

            {error && (
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
            )}

            <Btn type="submit" variant="primary" className="w-full py-2.5 text-sm mt-1" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Войти в панель
            </Btn>
          </form>

          {demoHint && (
            <div className="mt-4 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 text-[11px] text-slate-400 leading-relaxed">
              <span className="text-cyan-300 font-semibold">Демо-режим.</span> Логин <code className="text-emerald-300 font-mono">admin</code>,
              пароль <code className="text-emerald-300 font-mono">demo12345</code>. На VPS учётные данные создаёт установщик
              и печатает в консоль после установки.
            </div>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-600 mt-4">Первого администратора создаёт установщик автоматически</p>
      </div>
    </div>
  );
}
