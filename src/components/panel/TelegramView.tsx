'use client';

// ============================================
// TelegramView.tsx — настройка бота управления
// ============================================
import { useCallback, useEffect, useState } from 'react';
import { Send, Link2, TestTube2, Unplug, Loader2, BellRing, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHead, Btn, Field, inputCls, Toggle, CopyBtn, Badge, Spinner } from './bits';
import { api } from '@/lib/awg/client';

type Toast = (m: string, t?: 'success' | 'error' | 'info') => void;

interface TgInfo {
  configured: boolean;
  running: boolean;
  hasCode: boolean;
  tokenMasked: string;
  bound: { id: string; name: string }[];
  notify: { created: boolean; expired: boolean; limit: boolean; disabled: boolean };
}

const NOTIFY_LABELS: Record<string, string> = {
  created: 'Создание клиентов',
  expired: 'Истечение срока доступа',
  limit: 'Достижение лимита трафика',
  disabled: 'Ручное отключение'
};

export default function TelegramView({ toast }: { toast: Toast }) {
  const [info, setInfo] = useState<TgInfo | null>(null);
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { setInfo(await api<TgInfo>('/api/telegram')); }
    catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const act = async (json: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey);
    try {
      const r = await api<{ message?: string; code?: string }>('/api/telegram', { json });
      if (r.code !== undefined) setCode(r.code);
      if (r.message) toast(r.message);
      await load();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  if (!info) return <div className="py-20 flex justify-center"><Spinner className="w-6 h-6" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Подключение бота" icon={<Send className="w-4 h-4" />}
          right={
            info.running ? <Badge tone="green">бот запущен</Badge> :
            info.configured ? <Badge tone="amber">запускается…</Badge> : <Badge tone="slate">не настроен</Badge>
          } />
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 bg-slate-950/50 border border-slate-800 rounded-xl p-3">
            <span className="text-[16px] leading-none mt-0.5">🤖</span>
            <p className="text-[11.5px] text-slate-400 leading-relaxed">
              Бот позволяет управлять панелью из Telegram: <code className="text-emerald-300">/status</code>,{' '}
              <code className="text-emerald-300">/peers</code>, <code className="text-emerald-300">/add Имя</code> (создать клиента и получить конфиг с QR),{' '}
              <code className="text-emerald-300">/on</code>/<code className="text-emerald-300">/off</code>, <code className="text-emerald-300">/del</code>.
              1. Создайте бота у <span className="text-cyan-300">@BotFather</span> и получите токен. 2. Вставьте токен сюда. 3. Сгенерируйте код привязки
              и отправьте боту <code className="text-emerald-300">/start КОД</code>.
            </p>
          </div>

          <Field label="Токен бота" hint={info.configured ? `текущий: ${info.tokenMasked}` : 'формат: 123456789:AA...'}>
            <input className={inputCls + ' font-mono'} value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA..." />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => void act({ action: 'save', token }, 'save')} disabled={busy === 'save'}>
              {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Сохранить токен
            </Btn>
            <Btn onClick={() => void act({ action: 'save', token: '' }, 'save')} disabled={busy === 'save' || !info.configured}>Отключить бота</Btn>
            <Btn onClick={() => void act({ action: 'test' }, 'test')} disabled={busy === 'test' || !info.running}>
              {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />} Тест-сообщение
            </Btn>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Привязка администраторов" icon={<Link2 className="w-4 h-4" />}
          sub={info.hasCode ? 'код активен — отправьте его боту' : undefined} />
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={() => void act({ action: 'link' }, 'link')} disabled={busy === 'link'}><Link2 className="w-3.5 h-3.5" /> Сгенерировать код</Btn>
            {code && (
              <>
                <span className="font-mono text-lg font-bold tracking-widest text-emerald-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">{code}</span>
                <CopyBtn text={`/start ${code}`} label="Копировать команду" />
              </>
            )}
          </div>
          {code && <p className="text-[11px] text-slate-500">Отправьте боту команду <code className="text-emerald-300">/start {code}</code> — чат привяжется автоматически. Код одноразовый.</p>}

          <div className="pt-2">
            <p className="text-[11px] font-semibold text-slate-400 mb-2">Привязанные чаты ({info.bound.length})</p>
            {info.bound.length ? (
              <div className="space-y-2">
                {info.bound.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[13px] text-slate-200 truncate">{u.name || 'без имени'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID {u.id}</p>
                      </div>
                    </div>
                    <Btn variant="danger" onClick={() => void act({ action: 'unbind', userId: u.id }, 'unbind')} disabled={busy === 'unbind'}>
                      <Unplug className="w-3.5 h-3.5" /> Отвязать
                    </Btn>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Пока никто не привязан. Сгенерируйте код и отправьте боту <code className="text-emerald-300">/start КОД</code> в Telegram.</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Уведомления" icon={<BellRing className="w-4 h-4" />} sub="что присылать в привязанные чаты" />
        <div className="p-4 grid sm:grid-cols-2 gap-2.5">
          {Object.keys(NOTIFY_LABELS).map((k) => (
            <div key={k} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2.5">
              <span className="text-[12.5px] text-slate-300">{NOTIFY_LABELS[k]}</span>
              <Toggle on={(info.notify as unknown as Record<string, boolean>)[k]}
                onChange={() => void act({ action: 'notify', notify: { [k]: !(info.notify as unknown as Record<string, boolean>)[k] } }, 'notify')} />
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            {info.running ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-500" />}
            {info.running ? 'Бот работает (long polling)' : 'Бот не запущен — сохраните токен от @BotFather'}
          </p>
        </div>
      </Card>
    </div>
  );
}
