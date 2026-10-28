'use client';

// ============================================
// ServerView.tsx — настройки сервера и параметры обфускации AWG
// ============================================
import { useCallback, useEffect, useState } from 'react';
import { Server, Shuffle, Save, RotateCw, Play, KeyRound, Eye, Loader2, ShieldCheck, FileCode2 } from 'lucide-react';
import { Card, CardHead, Btn, Field, inputCls, Toggle, CopyBtn, Badge, Spinner } from './bits';
import { api, type PanelState, type Obf } from '@/lib/awg/client';

type Toast = (m: string, t?: 'success' | 'error' | 'info') => void;

const OBF_COMMON: { key: keyof Obf; label: string; hint: string }[] = [
  { key: 'Jc', label: 'Jc', hint: 'мусорные пакеты, 1..128 (рек. 4..12)' },
  { key: 'Jmin', label: 'Jmin', hint: 'мин. размер мусора, < 1280' },
  { key: 'Jmax', label: 'Jmax', hint: 'макс. размер мусора, > Jmin' },
  { key: 'S1', label: 'S1', hint: 'префикс Init, 0..1132' },
  { key: 'S2', label: 'S2', hint: 'префикс Response, 0..1188, S1+56≠S2' }
];

const OBF_V2: { key: keyof Obf; label: string; hint: string }[] = [
  { key: 'S3', label: 'S3', hint: 'префикс Cookie (2.0+)' },
  { key: 'S4', label: 'S4', hint: 'префикс Transport (2.0+)' },
  { key: 'I1', label: 'I1', hint: 'CPS-сигнатура 1 (имитация QUIC)' },
  { key: 'I2', label: 'I2', hint: 'CPS-сигнатура 2' },
  { key: 'I3', label: 'I3', hint: 'CPS-сигнатура 3 (опц.)' },
  { key: 'I4', label: 'I4', hint: 'CPS-сигнатура 4 (опц.)' },
  { key: 'I5', label: 'I5', hint: 'CPS-сигнатура 5 (опц.)' }
];

const OBF_V31: { key: keyof Obf; label: string; hint: string }[] = [
  { key: 'HeaderProtectionKey', label: 'HeaderProtectionKey', hint: '32 байта base64 — шифрование заголовков' },
  { key: 'ContentPaddingAddition', label: 'ContentPaddingAddition', hint: 'паддинг содержимого, напр. 8-64' },
  { key: 'RekeyAfterTime', label: 'RekeyAfterTime', hint: 'таймер ререйза (опц.)' },
  { key: 'RekeyTimeout', label: 'RekeyTimeout', hint: 'таймаут ререйза (опц.)' },
  { key: 'RejectAfterTime', label: 'RejectAfterTime', hint: 'предел жизни сессии (опц.)' },
  { key: 'KeepaliveTimeout', label: 'KeepaliveTimeout', hint: 'таймаут keepalive (опц.)' },
  { key: 'MaxHandshakeAttempts', label: 'MaxHandshakeAttempts', hint: 'попытки handshake (опц.)' }
];

export default function ServerView({ state, setState, toast }: { state: PanelState | null; setState: (s: PanelState) => void; toast: Toast }) {
  const [form, setForm] = useState<PanelState['server'] | null>(null);
  const [obf, setObf] = useState<Obf | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [confText, setConfText] = useState('');
  const [showConf, setShowConf] = useState(false);

  const loadConf = useCallback(async () => {
    try {
      const r = await api<{ conf: string }>('/api/server/conf');
      setConfText(r.conf);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);

  useEffect(() => {
    if (state && !form) {
      setForm({ ...state.server });
      setObf({ ...state.server.obf });
    }
  }, [state, form]);

  const saveSettings = async () => {
    if (!form) return;
    setBusy('settings');
    try {
      const r = await api<{ server: PanelState['server'] }>('/api/server/settings', {
        json: {
          iface: form.iface, wanIface: form.wanIface, endpoint: form.endpoint, port: form.port,
          subnet: form.subnet, serverIp: form.serverIp, dns: form.dns, keepalive: form.keepalive,
          autoDisableLimit: form.autoDisableLimit, autoDisableExpired: form.autoDisableExpired
        }
      });
      const next = { ...state!, server: r.server };
      setState(next);
      setForm({ ...r.server });
      setObf({ ...r.server.obf });
      toast('Настройки сервера сохранены');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const changeVersion = async (version: string) => {
    setBusy('version');
    try {
      const r = await api<{ obf: Obf; message: string }>('/api/server/obf', { json: { version } });
      setObf(r.obf);
      setForm((f) => f ? { ...f, obf: r.obf } : f);
      toast(r.message);
      void loadConf();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const randomize = async (preset: string) => {
    setBusy('rnd');
    try {
      const r = await api<{ obf: Obf; message: string }>('/api/server/obf', { json: { preset } });
      setObf(r.obf);
      setForm((f) => f ? { ...f, obf: r.obf } : f);
      toast(r.message);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const saveObf = async () => {
    if (!obf) return;
    setBusy('obf');
    try {
      const r = await api<{ obf: Obf; message: string }>('/api/server/obf', { json: { obf } });
      setObf(r.obf);
      toast(r.message);
      void loadConf();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const apply = async () => {
    setBusy('apply');
    try {
      const r = await api<{ ok: boolean; message: string; demo?: boolean }>('/api/server/apply', { json: {} });
      toast(r.message, r.ok ? 'success' : 'error');
      void loadConf();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const restart = async () => {
    setBusy('restart');
    try {
      const r = await api<{ ok: boolean; message: string; demo?: boolean }>('/api/server/restart', { json: {} });
      toast(r.message, r.ok ? 'success' : 'info');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const rotServerKeys = async () => {
    if (!confirm('Заменить ключи сервера? Все клиенты должны будут импортировать новые конфиги!')) return;
    setBusy('rot');
    try {
      const r = await api<{ message: string; server: PanelState['server'] }>('/api/server/settings', { json: { rotKeys: true } });
      setForm({ ...r.server });
      setState({ ...state!, server: r.server });
      toast(r.message, 'info');
      void loadConf();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  if (!form || !obf) return <div className="py-20 flex justify-center"><Spinner className="w-6 h-6" /></div>;

  const H = (k: 'H1' | 'H2' | 'H3' | 'H4', label: string) => (
    <Field key={k} label={label} hint="уникальный магический заголовок">
      <input className={inputCls + ' font-mono'} value={String(obf[k] ?? '')}
        onChange={(e) => setObf({ ...obf, [k]: e.target.value })} />
    </Field>
  );

  return (
    <div className="space-y-4">
      {/* ===== Параметры интерфейса ===== */}
      <Card>
        <CardHead title="Параметры интерфейса" icon={<Server className="w-4 h-4" />}
          sub={state?.runtime?.toolVersion ? `утилиты: ${state.runtime.toolVersion}` : 'утилиты AWG не найдены (режим конфигуратора)'}
          right={<Badge tone={state?.runtime?.ifaceUp ? 'green' : 'red'}>{form.iface} {state?.runtime?.ifaceUp ? 'активен' : 'остановлен'}</Badge>} />
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Endpoint (адрес сервера)" hint="выдаётся в конфигах клиентов">
            <input className={inputCls} value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="1.2.3.4 или vpn.example.com" />
          </Field>
          <Field label="Порт VPN (UDP)">
            <input className={inputCls} type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="DNS для клиентов">
            <input className={inputCls} value={form.dns} onChange={(e) => setForm({ ...form, dns: e.target.value })} />
          </Field>
          <Field label="Интерфейс">
            <input className={inputCls} value={form.iface} onChange={(e) => setForm({ ...form, iface: e.target.value })} />
          </Field>
          <Field label="WAN-интерфейс (NAT)" hint="куда маскировать трафик клиентов">
            <input className={inputCls} value={form.wanIface} onChange={(e) => setForm({ ...form, wanIface: e.target.value })} />
          </Field>
          <Field label="Подсеть VPN">
            <input className={inputCls} value={form.subnet} onChange={(e) => setForm({ ...form, subnet: e.target.value })} />
          </Field>
          <Field label="IP сервера в подсети">
            <input className={inputCls} value={form.serverIp} onChange={(e) => setForm({ ...form, serverIp: e.target.value })} />
          </Field>
          <Field label="PersistentKeepalive, сек">
            <input className={inputCls} type="number" value={form.keepalive} onChange={(e) => setForm({ ...form, keepalive: Number(e.target.value) || 0 })} />
          </Field>
          <div className="flex flex-col gap-2 justify-end">
            <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-[12px] text-slate-300">Отключать при истечении</span>
              <Toggle on={form.autoDisableExpired} onChange={() => setForm({ ...form, autoDisableExpired: !form.autoDisableExpired })} />
            </div>
            <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-[12px] text-slate-300">Отключать по лимиту</span>
              <Toggle on={form.autoDisableLimit} onChange={() => setForm({ ...form, autoDisableLimit: !form.autoDisableLimit })} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <Btn variant="primary" onClick={() => void saveSettings()} disabled={busy === 'settings'}>
            {busy === 'settings' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Сохранить настройки
          </Btn>
          <Btn onClick={() => void apply()} disabled={busy === 'apply'}>
            {busy === 'apply' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Применить на сервере
          </Btn>
          <Btn onClick={() => void restart()} disabled={busy === 'restart'}>
            {busy === 'restart' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />} Перезапустить интерфейс
          </Btn>
          <Btn variant="danger" onClick={() => void rotServerKeys()} disabled={busy === 'rot'}>
            {busy === 'rot' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />} Заменить ключи сервера
          </Btn>
        </div>
      </Card>

      {/* ===== Обфускация ===== */}
      <Card>
        <CardHead title="Обфускация AmneziaWG (анти-DPI)" icon={<ShieldCheck className="w-4 h-4" />}
          sub="параметры маскировки трафика от РКН/DPI" right={<Badge tone="green">AWG {obf.version}</Badge>} />

        {/* Выбор версии */}
        <div className="px-4 pt-4 flex flex-wrap items-center gap-2">
          {(['1.5', '2.0', '3.1'] as const).map((v) => (
            <button key={v} onClick={() => void changeVersion(v)} disabled={busy === 'version'}
              className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                obf.version === v ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}>
              AWG {v}
            </button>
          ))}
          <span className="text-[11px] text-slate-500 ml-1">— при смене версии генерируется новый набор параметров</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {OBF_COMMON.map(({ key, label, hint }) => (
              <Field key={String(key)} label={label} hint={hint}>
                <input className={inputCls + ' font-mono'} value={String(obf[key] ?? '')}
                  onChange={(e) => setObf({ ...obf, [key]: e.target.value } as Obf)} />
              </Field>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-400 mb-2">Заголовки H1–H4 {obf.version !== '1.5' ? '(диапазоны без пересечений)' : '(уникальные числа)'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {H('H1', 'H1')}{H('H2', 'H2')}{H('H3', 'H3')}{H('H4', 'H4')}
            </div>
          </div>

          {obf.version !== '1.5' && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 mb-2">Расширенные параметры 2.0+ (S3/S4, CPS-сигнатуры I1–I5)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {OBF_V2.map(({ key, label, hint }) => (
                  <Field key={String(key)} label={label} hint={hint}>
                    <input className={inputCls + ' font-mono'} value={String(obf[key] ?? '')}
                      onChange={(e) => setObf({ ...obf, [key]: e.target.value } as Obf)} />
                  </Field>
                ))}
              </div>
            </div>
          )}

          {obf.version === '3.1' && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 mb-2">Механизмы 3.1 (шифрование заголовков, паддинг, таймеры)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {OBF_V31.map(({ key, label, hint }) => (
                  <Field key={String(key)} label={label} hint={hint}>
                    <input className={inputCls + ' font-mono text-[11.5px]'} value={String(obf[key] ?? '')}
                      onChange={(e) => setObf({ ...obf, [key]: e.target.value } as Obf)} />
                  </Field>
                ))}
              </div>
            </div>
          )}

          <Field label="Доп. строки в конфиг (вручную)" hint="будут добавлены в [Interface] как есть">
            <textarea className={inputCls + ' font-mono text-[12px]'} rows={2} value={obf.extra} onChange={(e) => setObf({ ...obf, extra: e.target.value })} />
          </Field>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Btn variant="primary" onClick={() => void saveObf()} disabled={busy === 'obf'}>
              {busy === 'obf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Сохранить параметры
            </Btn>
            <Btn onClick={() => void randomize('standard')} disabled={busy === 'rnd'}><Shuffle className="w-3.5 h-3.5" /> Стандартный пресет</Btn>
            <Btn onClick={() => void randomize('light')} disabled={busy === 'rnd'}><Shuffle className="w-3.5 h-3.5" /> Лёгкий</Btn>
            <Btn onClick={() => void randomize('max')} disabled={busy === 'rnd'}><Shuffle className="w-3.5 h-3.5" /> Максимальная маскировка</Btn>
            <span className="text-[11px] text-slate-500">случайные параметры = уникальный «отпечаток» вашего сервера</span>
          </div>
        </div>
      </Card>

      {/* ===== Конфиг сервера ===== */}
      <Card>
        <CardHead title="Серверный конфиг" icon={<FileCode2 className="w-4 h-4" />}
          sub={'/etc/amnezia/amneziawg/' + form.iface + '.conf'}
          right={
            <Btn onClick={() => { setShowConf(!showConf); void loadConf(); }}>
              <Eye className="w-3.5 h-3.5" /> {showConf ? 'Скрыть' : 'Показать'}
            </Btn>
          } />
        {showConf && (
          <div className="p-4 space-y-2">
            <pre className="conf max-h-96 overflow-auto bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11.5px] leading-relaxed font-mono text-slate-300">{confText || 'Загрузка…'}</pre>
            <CopyBtn text={confText} label="Копировать серверный конфиг" />
          </div>
        )}
      </Card>
    </div>
  );
}
