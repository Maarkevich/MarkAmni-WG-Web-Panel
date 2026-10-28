'use client';

// ============================================
// RoutingView.tsx — маршрутизация: режимы, список geoip:ru
// ============================================
import { useCallback, useEffect, useState } from 'react';
import { Globe, RefreshCw, Download, ListTree, Loader2 } from 'lucide-react';
import { Card, CardHead, Btn, Badge, Spinner } from './bits';
import { api, fmtDateTime } from '@/lib/awg/client';

type Toast = (m: string, t?: 'success' | 'error' | 'info') => void;

interface RoutingInfo {
  mode: string;
  ru: { exists: boolean; count: number; updatedAt: string | null };
  modes: Record<string, { title: string; desc: string }>;
}

export default function RoutingView({ state, toast }: { state: PanelState | null; toast: Toast }) {
  const [info, setInfo] = useState<RoutingInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setInfo(await api<RoutingInfo>('/api/routing')); }
    catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const setMode = async (mode: string) => {
    try {
      await api('/api/routing', { json: { mode } });
      await load();
      toast(`Режим по умолчанию: ${info?.modes[mode]?.title || mode}`);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const updateRu = async () => {
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/api/routing', { json: { action: 'ru-update' } });
      await load();
      toast(r.message);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  if (!info) return <div className="py-20 flex justify-center"><Spinner className="w-6 h-6" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Режим маршрутизации для новых клиентов" icon={<Globe className="w-4 h-4" />}
          sub="каждому клиенту можно задать свой режим — это значение по умолчанию" />
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          {Object.entries(info.modes).map(([key, m]) => (
            <button key={key} onClick={() => void setMode(key)}
              className={`text-left p-4 rounded-xl border transition-colors ${
                info.mode === key ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/50 border-slate-800 hover:border-slate-600'
              }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[13px] font-semibold ${info.mode === key ? 'text-emerald-300' : 'text-slate-200'}`}>{m.title}</span>
                {info.mode === key && <Badge tone="green">по умолчанию</Badge>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="База подсетей geoip:ru" icon={<ListTree className="w-4 h-4" />}
          sub="используется для режима «Только Россия» и обхода блокировок"
          right={info.ru.exists ? <Badge tone="green">{info.ru.count.toLocaleString('ru-RU')} подсетей</Badge> : <Badge tone="red">не загружена</Badge>} />
        <div className="p-4 space-y-3">
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Панель скачивает актуальные подсети РФ (IPv4 + IPv6) и подставляет их в поле <code className="font-mono text-emerald-300">AllowedIPs</code> клиентских конфигов.
            Так трафик российских сервисов (банки, госуслуги) идёт напрямую, а остальной трафик — через VPN. Имена доменов (geosite:ru)
            в WireGuard-маршрутизации не участвуют — на стороне AWG работает именно geoip-подход по IP-подсетям.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="primary" onClick={() => void updateRu()} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Обновить список
            </Btn>
            <span className="text-[11px] text-slate-500">
              {info.ru.exists ? <>обновлён: {fmtDateTime(info.ru.updatedAt)}</> : 'список не загружен — клиенты в режиме «ru» получат полный туннель'}
            </span>
          </div>
          <div className="flex items-start gap-2 bg-slate-950/50 border border-slate-800 rounded-xl p-3">
            <Download className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Источники: ipverse/ru (GitHub) → ipdeny.com (fallback). На VPS обновление можно автоматизировать cron-задачей
              (см. README раздел «Маршрутизация»).
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
