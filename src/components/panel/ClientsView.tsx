'use client';

// ============================================
// ClientsView.tsx — управление клиентами: список, добавление,
// редактирование, экспорт (.conf / QR / vpn://)
// ============================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Download, Trash2, Power, KeyRound, QrCode, Link2,
  FileText, Pencil, Loader2, Users
} from 'lucide-react';
import { Card, Btn, Field, inputCls, Toggle, CopyBtn, Modal, StatusDot, Badge, Empty, Spinner } from './bits';
import { api, bytes, fmtDate, ROUTING_TITLES, type ClientRow, type PanelState } from '@/lib/awg/client';

interface Export {
  conf: string;
  vpn: string;
  qr: string | null;
  qrTooBig: boolean;
  filename: string;
  version: string;
}

const emptyForm = { name: '', comment: '', mode: 'full' as ClientRow['mode'], allowedIps: '', trafficLimitGb: 0, expiresAt: '', enabled: true };

export default function ClientsView({ state, toast }: { state: PanelState | null; toast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [exporting, setExporting] = useState<Export | null>(null);
  const [exportTab, setExportTab] = useState<'conf' | 'qr' | 'vpn'>('conf');
  const [confirmDel, setConfirmDel] = useState<ClientRow | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ clients: ClientRow[] }>('/api/clients');
      setClients(r.clients);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const s = q.trim().toLowerCase();
    return s ? clients.filter((c) => c.name.toLowerCase().includes(s) || c.ip.includes(s) || c.comment.toLowerCase().includes(s)) : clients;
  }, [clients, q]);

  const submitAdd = async () => {
    if (!form.name.trim()) return toast('Укажите имя клиента', 'error');
    setBusy(true);
    try {
      await api('/api/clients', { json: form });
      toast(`Клиент «${form.name}» создан`);
      setAddOpen(false);
      setForm({ ...emptyForm });
      await load();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/api/clients/${editing.id}`, {
        method: 'PUT',
        json: {
          name: editing.name, comment: editing.comment, mode: editing.mode,
          allowedIps: editing.allowedIps, trafficLimitGb: editing.trafficLimitGb,
          expiresAt: editing.expiresAt, enabled: editing.enabled
        }
      });
      toast('Изменения сохранены');
      setEditing(null);
      await load();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const toggle = async (c: ClientRow) => {
    try {
      await api(`/api/clients/${c.id}`, { method: 'POST' });
      await load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const del = async (c: ClientRow) => {
    try {
      await api(`/api/clients/${c.id}`, { method: 'DELETE' });
      toast(`Клиент «${c.name}» удалён`);
      setConfirmDel(null);
      await load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const rotKeys = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const r = await api<{ client: ClientRow }>(`/api/clients/${editing.id}`, { method: 'PUT', json: { rotKeys: true } });
      setEditing(r.client);
      toast('Ключи клиента заменены — раздайте новый конфиг');
      await load();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const openExport = async (c: ClientRow, tab: 'conf' | 'qr' | 'vpn' = 'conf') => {
    setExportTab(tab);
    try {
      const r = await api<Export>(`/api/clients/${c.id}/export`);
      setExporting(r);
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-4">
      {/* Панель поиска */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени, IP или комментарию…"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-[13px] outline-none focus:border-emerald-500/60" />
        </div>
        <Btn variant="primary" onClick={() => setAddOpen(true)} className="py-2.5 px-4 shrink-0">
          <Plus className="w-4 h-4" /> Добавить клиента
        </Btn>
      </div>

      {/* Список */}
      <Card>
        {!clients ? (
          <div className="py-16 flex justify-center"><Spinner className="w-6 h-6" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon={<Users className="w-5 h-5" />} title={q ? 'Ничего не найдено' : 'Клиентов пока нет'}
            sub={q ? 'Попробуйте изменить запрос' : 'Нажмите «Добавить клиента» — панель создаст ключи и IP автоматически'} />
        ) : (
          <>
            {/* Десктоп: таблица */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 border-b border-slate-800">
                    <th className="px-4 py-2.5 font-medium">Клиент</th>
                    <th className="px-4 py-2.5 font-medium">IP</th>
                    <th className="px-4 py-2.5 font-medium">Режим</th>
                    <th className="px-4 py-2.5 font-medium">Трафик</th>
                    <th className="px-4 py-2.5 font-medium">Рукопожатие</th>
                    <th className="px-4 py-2.5 font-medium">Действует до</th>
                    <th className="px-4 py-2.5 font-medium text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <StatusDot on={c.enabled && c.usage?.online} />
                          <div className="min-w-0">
                            <p className={`font-medium truncate ${c.enabled ? 'text-slate-100' : 'text-slate-500 line-through'}`}>{c.name}</p>
                            {c.comment && <p className="text-[11px] text-slate-500 truncate">{c.comment}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-slate-300">{c.ip}</td>
                      <td className="px-4 py-3">
                        <Badge tone={c.mode === 'full' ? 'slate' : c.mode === 'ru' ? 'cyan' : 'amber'}>
                          {ROUTING_TITLES[c.mode] || c.mode}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        ↓ {bytes(c.usage?.rx || 0)}<br />↑ {bytes(c.usage?.tx || 0)}
                        {c.trafficLimitGb > 0 && <span className="text-amber-400/80"> / {c.trafficLimitGb} ГБ</span>}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-400">{c.usage?.lastHandshake || '—'}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-400">{c.expiresAt ? fmtDate(c.expiresAt) : '∞'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button title="Конфиг / QR / vpn://" onClick={() => void openExport(c)}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"><KeyRound className="w-4 h-4" /></button>
                          <button title="Включить/выключить" onClick={() => void toggle(c)}
                            className={`p-2 rounded-lg transition-colors ${c.enabled ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'}`}><Power className="w-4 h-4" /></button>
                          <button title="Редактировать" onClick={() => setEditing(c)}
                            className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button title="Удалить" onClick={() => setConfirmDel(c)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Мобильные карточки */}
            <div className="md:hidden divide-y divide-slate-800/60">
              {filtered.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StatusDot on={c.enabled && c.usage?.online} />
                      <div className="min-w-0">
                        <p className={`font-medium text-[14px] truncate ${c.enabled ? 'text-slate-100' : 'text-slate-500 line-through'}`}>{c.name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{c.ip}</p>
                      </div>
                    </div>
                    <Badge tone={c.mode === 'full' ? 'slate' : c.mode === 'ru' ? 'cyan' : 'amber'}>{ROUTING_TITLES[c.mode] || c.mode}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 mb-3">
                    <span>↓ {bytes(c.usage?.rx || 0)} · ↑ {bytes(c.usage?.tx || 0)}{c.trafficLimitGb > 0 ? ` / ${c.trafficLimitGb} ГБ` : ''}</span>
                    <span>{c.usage?.lastHandshake || '—'}</span>
                    {c.expiresAt && <span>до {fmtDate(c.expiresAt)}</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Btn onClick={() => void openExport(c)} className="flex-1"><KeyRound className="w-3.5 h-3.5" /> Конфиг</Btn>
                    <Btn onClick={() => void toggle(c)} className={c.enabled ? 'text-emerald-300' : ''}><Power className="w-3.5 h-3.5" />{c.enabled ? 'Вкл' : 'Выкл'}</Btn>
                    <Btn onClick={() => setEditing(c)}><Pencil className="w-3.5 h-3.5" /></Btn>
                    <Btn variant="danger" onClick={() => setConfirmDel(c)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Модалка добавления */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Новый клиент">
        <div className="space-y-3">
          <Field label="Имя клиента">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="iPhone-Алексей" autoFocus />
          </Field>
          <Field label="Комментарий">
            <input className={inputCls} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="необязательно" />
          </Field>
          <Field label="Маршрутизация" hint={form.mode === 'custom' ? 'Укажите AllowedIPs вручную' : undefined}>
            <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as ClientRow['mode'] })}>
              <option value="full">Полный туннель (0.0.0.0/0)</option>
              <option value="ru">Только Россия (geoip:ru)</option>
              <option value="nolocal">Весь трафик, кроме локальной сети</option>
              <option value="custom">Свой список AllowedIPs</option>
            </select>
          </Field>
          {form.mode === 'custom' && (
            <Field label="AllowedIPs">
              <textarea className={inputCls + ' font-mono text-[12px]'} rows={3} value={form.allowedIps}
                onChange={(e) => setForm({ ...form, allowedIps: e.target.value })} placeholder="0.0.0.0/0, ::/0" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Лимит, ГБ" hint="0 — без лимита">
              <input className={inputCls} type="number" min={0} value={form.trafficLimitGb || ''} onChange={(e) => setForm({ ...form, trafficLimitGb: Number(e.target.value) || 0 })} placeholder="0" />
            </Field>
            <Field label="Действует до" hint="пусто — бессрочно">
              <input className={inputCls} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[13px] text-slate-300">Клиент включён</span>
            <Toggle on={form.enabled} onChange={() => setForm({ ...form, enabled: !form.enabled })} />
          </div>
          <Btn variant="primary" className="w-full py-2.5" onClick={() => void submitAdd()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Создать клиента
          </Btn>
          <p className="text-[11px] text-slate-500 text-center">IP-адрес и ключи (Curve25519 + PSK) будут сгенерированы автоматически</p>
        </div>
      </Modal>

      {/* Модалка редактирования */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Редактирование: ${editing?.name || ''}`}>
        {editing && (
          <div className="space-y-3">
            <Field label="Имя">
              <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Комментарий">
              <input className={inputCls} value={editing.comment} onChange={(e) => setEditing({ ...editing, comment: e.target.value })} />
            </Field>
            <Field label="Маршрутизация">
              <select className={inputCls} value={editing.mode} onChange={(e) => setEditing({ ...editing, mode: e.target.value as ClientRow['mode'] })}>
                <option value="full">Полный туннель</option>
                <option value="ru">Только Россия (geoip:ru)</option>
                <option value="nolocal">Без домашней сети</option>
                <option value="custom">Свой список</option>
              </select>
            </Field>
            {editing.mode === 'custom' && (
              <Field label="AllowedIPs">
                <textarea className={inputCls + ' font-mono text-[12px]'} rows={3} value={editing.allowedIps} onChange={(e) => setEditing({ ...editing, allowedIps: e.target.value })} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Лимит, ГБ" hint="0 — без лимита">
                <input className={inputCls} type="number" min={0} value={editing.trafficLimitGb || ''} onChange={(e) => setEditing({ ...editing, trafficLimitGb: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Действует до">
                <input className={inputCls} type="date" value={editing.expiresAt || ''} onChange={(e) => setEditing({ ...editing, expiresAt: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-slate-300">Клиент включён</span>
              <Toggle on={editing.enabled} onChange={() => setEditing({ ...editing, enabled: !editing.enabled })} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Btn onClick={() => void rotKeys()} disabled={busy}><KeyRound className="w-3.5 h-3.5" /> Заменить ключи</Btn>
              <Btn variant="primary" onClick={() => void saveEdit()} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Сохранить</Btn>
            </div>
            <p className="text-[10px] text-slate-600 font-mono break-all bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
              {editing.publicKey}
            </p>
          </div>
        )}
      </Modal>

      {/* Модалка удаления */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удалить клиента?">
        <p className="text-[13px] text-slate-300 mb-1">
          Клиент <span className="font-semibold text-rose-300">{confirmDel?.name}</span> ({confirmDel?.ip}) будет удалён из панели и из конфига сервера при следующем применении.
        </p>
        <p className="text-[11px] text-slate-500 mb-4">Его конфиги перестанут работать. Действие необратимо.</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={() => setConfirmDel(null)}>Отмена</Btn>
          <Btn variant="danger" onClick={() => confirmDel && void del(confirmDel)}><Trash2 className="w-3.5 h-3.5" /> Удалить</Btn>
        </div>
      </Modal>

      {/* Модалка экспорта */}
      <Modal open={!!exporting} onClose={() => setExporting(null)} title="Конфигурация клиента" wide>
        {exporting && (
          <div className="space-y-3">
            <div className="flex gap-1 bg-slate-950/60 border border-slate-800 rounded-xl p-1">
              {([['conf', 'Файл .conf', <FileText key="a" className="w-3.5 h-3.5" />],
                 ['qr', 'QR-код', <QrCode key="b" className="w-3.5 h-3.5" />],
                 ['vpn', 'vpn:// для AmneziaVPN', <Link2 key="c" className="w-3.5 h-3.5" />]] as const).map(([k, label, icon]) => (
                <button key={k} onClick={() => setExportTab(k)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                    exportTab === k ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  {icon} <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {exportTab === 'conf' && (
              <>
                <pre className="conf max-h-72 overflow-auto bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11.5px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-all">{exporting.conf}</pre>
                <div className="flex gap-2">
                  <CopyBtn text={exporting.conf} label="Копировать конфиг" />
                  <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(exporting.conf)}`} download={exporting.filename}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Скачать .conf
                  </a>
                  <Badge tone="cyan">AWG {exporting.version}</Badge>
                </div>
              </>
            )}

            {exportTab === 'qr' && (
              <div className="flex flex-col items-center gap-3 py-2">
                {exporting.qr ? (
                  <>
                    <img src={exporting.qr} alt="QR-код конфигурации" className="rounded-xl border border-slate-700 bg-white p-2 w-56 h-56" />
                    <p className="text-[11px] text-slate-500 text-center max-w-xs">Откройте приложение AmneziaVPN → «+» → сканируйте QR-код</p>
                  </>
                ) : (
                  <p className="text-[12px] text-amber-300 text-center max-w-xs">
                    Конфиг слишком велик для QR (используется список geoip:ru). Скачайте .conf или используйте ссылку vpn://
                  </p>
                )}
              </div>
            )}

            {exportTab === 'vpn' && (
              <>
                <p className="text-[12px] text-slate-400">
                  Скопируйте ссылку и вставьте в AmneziaVPN: «+» → «Вставить из буфера». Подходит для передачи через мессенджеры.
                </p>
                <pre className="max-h-40 overflow-auto bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10.5px] font-mono text-emerald-300/90 break-all whitespace-pre-wrap">{exporting.vpn}</pre>
                <div className="flex gap-2 flex-wrap">
                  <CopyBtn text={exporting.vpn} label="Копировать vpn:// ссылку" />
                  <Badge tone="green">Импорт в 1 клик</Badge>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
