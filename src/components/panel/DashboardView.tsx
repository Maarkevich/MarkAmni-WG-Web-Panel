'use client';

// ============================================
// DashboardView.tsx — дашборд: статистика, телеметрия, график, события
// ============================================
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Activity, Users, ArrowDown, ArrowUp, Cpu, MemoryStick, HardDrive, Clock,
  Wifi, WifiOff, Gauge
} from 'lucide-react';
import { Card, CardHead, Badge, StatusDot, Empty } from './bits';
import { bytes, speed, uptime, fmtDateTime, type Dashboard as DashboardData } from '@/lib/awg/client';

function Gauge2({ label, value, total, icon, unit = '%' }: { label: string; value: number; total: number; icon: React.ReactNode; unit?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const color = pct > 85 ? 'bg-rose-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">{icon}{label}</span>
        <span className="text-[11px] font-semibold text-slate-200">{pct}{unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 mt-1.5">
        {bytes(value)} {total > 0 && <>из {bytes(total)}</>}
      </p>
    </div>
  );
}

export default function DashboardView({ data, iface }: { data: DashboardData | null; iface: string }) {
  if (!data) return <div className="py-20 flex justify-center"><span className="w-8 h-8 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" /></div>;
  const t = data.telemetry;
  const series = (t.series || []).map((p) => ({
    ...p,
    time: new Date(p.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    rxK: +(p.rx / 1024).toFixed(1),
    txK: +(p.tx / 1024).toFixed(1)
  }));

  const stats = [
    { label: 'Клиентов онлайн', value: `${data.stats.online}`, sub: `из ${data.stats.enabled} включённых`, icon: data.stats.online > 0 ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />, tone: data.stats.online > 0 ? 'text-emerald-300' : 'text-slate-400' },
    { label: 'Всего пиров', value: `${data.stats.totalPeers}`, sub: 'в конфигурации', icon: <Users className="w-4 h-4" />, tone: 'text-slate-200' },
    { label: 'Трафик сегодня', value: bytes(data.trafficToday.rx + data.trafficToday.tx), sub: `↓ ${bytes(data.trafficToday.rx)} · ↑ ${bytes(data.trafficToday.tx)}`, icon: <Activity className="w-4 h-4" />, tone: 'text-cyan-300' },
    { label: 'Нагрузка CPU', value: `${t.cpu}%`, sub: `${t.cpuCores} ядер · load ${t.load?.[0] ?? '—'}`, icon: <Cpu className="w-4 h-4" />, tone: 'text-slate-200' }
  ];

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400">{s.label}</span>
              <span className={s.tone}>{s.icon}</span>
            </div>
            <p className={`text-xl font-bold ${s.tone}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* График трафика */}
      <Card>
        <CardHead title="Трафик сервера" icon={<Activity className="w-4 h-4" />}
          sub={`↓ ${speed(t.net?.rxSec || 0)}  ·  ↑ ${speed(t.net?.txSec || 0)}`}
          right={<Badge tone="cyan">{iface}</Badge>} />
        <div className="p-3 sm:p-4 h-56">
          {series.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gRx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit=" КБ/с" width={62} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number | string, name: string) => [`${Number(value).toFixed(1)} КБ/с`, name === 'rxK' ? 'Приём' : 'Отдача']}
                />
                <Area type="monotone" dataKey="rxK" stroke="#10b981" strokeWidth={2} fill="url(#gRx)" />
                <Area type="monotone" dataKey="txK" stroke="#22d3ee" strokeWidth={2} fill="url(#gTx)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">Собираем телеметрию…</div>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Телеметрия */}
        <Card>
          <CardHead title="Телеметрия сервера" icon={<Gauge className="w-4 h-4" />} sub={t.platform} />
          <div className="p-4 grid grid-cols-2 gap-3">
            <Gauge2 label="CPU" value={t.cpu} total={100} icon={<Cpu className="w-3.5 h-3.5" />} />
            <Gauge2 label="RAM" value={t.ramUsed} total={t.ramTotal} icon={<MemoryStick className="w-3.5 h-3.5" />} />
            <Gauge2 label="Диск" value={t.diskUsed} total={t.diskTotal} icon={<HardDrive className="w-3.5 h-3.5" />} />
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5" />Аптайм</p>
              <p className="text-sm font-semibold text-slate-200">{uptime(t.uptime)}</p>
              <p className="text-[10px] text-slate-500 mt-1.5 truncate">{t.cpuModel || '—'}</p>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1"><ArrowDown className="w-3.5 h-3.5 text-emerald-400" />Через туннель</p>
                <p className="text-sm font-semibold text-slate-200">↓ {bytes(t.net?.awgTotalRx || 0)}</p>
                <p className="text-sm font-semibold text-slate-200">↑ {bytes(t.net?.awgTotalTx || 0)}</p>
              </div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3">
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1"><ArrowUp className="w-3.5 h-3.5 text-cyan-400" />Интерфейс сейчас</p>
                <p className="text-sm font-semibold text-slate-200">↓ {speed(t.net?.awgRxSec || 0)}</p>
                <p className="text-sm font-semibold text-slate-200">↑ {speed(t.net?.awgTxSec || 0)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Активность */}
        <div className="space-y-4">
          <Card>
            <CardHead title="Топ клиентов по трафику" icon={<Users className="w-4 h-4" />} />
            <div className="p-2">
              {data.topClients.length ? data.topClients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/40 transition-colors">
                  <StatusDot on={c.online} />
                  <span className="text-[13px] text-slate-200 font-medium flex-1 truncate">{c.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">↓ {bytes(c.rx)}</span>
                  <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">↑ {bytes(c.tx)}</span>
                </div>
              )) : <Empty title="Нет клиентов" sub="Создайте первого клиента в разделе «Клиенты»" />}
            </div>
          </Card>

          <Card>
            <CardHead title="Последние события" icon={<Activity className="w-4 h-4" />} />
            <div className="p-2 max-h-64 overflow-y-auto">
              {data.events.length ? data.events.map((e, i) => (
                <div key={i} className="px-3 py-2 hover:bg-slate-800/40 rounded-xl transition-colors">
                  <p className="text-[12px] text-slate-300">
                    <span className="text-emerald-300/80 font-medium">{e.actor}</span> — {e.action}
                    {e.details && <span className="text-slate-500"> · {e.details}</span>}
                  </p>
                  <p className="text-[10px] text-slate-600">{fmtDateTime(e.ts)}</p>
                </div>
              )) : <Empty title="Событий пока нет" />}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
