'use client';

// ============================================
// AdminsView.tsx — администраторы, права, профиль, бэкапы
// ============================================
import { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, ShieldCheck, Save, KeyRound, Download, Upload, Loader2 } from 'lucide-react';
import { Card, CardHead, Btn, Field, inputCls, Modal, Badge, Empty, Spinner, CopyBtn } from './bits';
import { api, fmtDate, PERM_TITLES, type SessionUser } from '@/lib/awg/client';

type Toast = (m: string, t?: 'success' | 'error' | 'info') => void;

interface AdminRow { id: string; username: string; role: 'root' | 'admin'; perms: string[]; createdAt: string }

const ALL_PERMS = ['dashboard', 'clients', 'server', 'routing', 'telegram', 'admins', 'logs'];

export default function AdminsView({ user, onUser, toast }: { user: SessionUser; onUser: (u: SessionUser) => void; toast: Toast }) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', perms: ['dashboard', 'clients'] as string[] });
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState<AdminRow | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [newPass, setNewPass] = useState('');
  const [profile, setProfile] = useState({ oldPassword: '', newPassword: '' });

  const load = useCallback(async () => {
    try {
      const r = await api<{ admins: AdminRow[] }>('/api/admins');
      setAdmins(r.admins);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const createAdmin = async () => {
    setBusy('add');
    try {
      await api('/api/admins', { json: form });
      toast(`Администратор «${form.username}» создан`);
      setAddOpen(false);
      setForm({ username: '', password: '', perms: ['dashboard', 'clients'] });
      await load();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy('edit');
    try {
      await api(`/api/admins/${edit.id}`, { method: 'PUT', json: { perms: editPerms, password: newPass || undefined } });
      toast(newPass ? 'Права обновлены, пароль сброшен' : 'Права обновлены');
      setEdit(null); setNewPass('');
      await load();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const del = async (a: AdminRow) => {
    if (!confirm(`Удалить администратора «${a.username}»?`)) return;
    try {
      await api(`/api/admins/${a.id}`, { method: 'DELETE' });
      toast('Удалён');
      await load();
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const saveProfile = async () => {
    setBusy('profile');
    try {
      await api('/api/me', { json: profile });
      toast('Пароль изменён');
      setProfile({ oldPassword: '', newPassword: '' });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const r = await api<{ message: string }>('/api/backup', { json: data });
      toast(r.message);
    } catch (e) { toast('Не удалось восстановить: ' + (e as Error).message, 'error'); }
  };

  if (!admins) return <div className="py-20 flex justify-center"><Spinner className="w-6 h-6" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Администраторы панели" icon={<UserCog className="w-4 h-4" />}
          right={<Btn variant="primary" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" /> Добавить</Btn>} />
        {admins.length === 0 ? <Empty title="Нет администраторов" /> : (
          <div className="divide-y divide-slate-800/60">
            {admins.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-[12px] font-bold text-emerald-300 uppercase shrink-0">
                  {a.username.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-slate-100">{a.username}</p>
                    {a.role === 'root' ? <Badge tone="green">главный</Badge> : <Badge tone="slate">ограниченный</Badge>}
                    {a.id === user.id && <Badge tone="cyan">это вы</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    создан {fmtDate(a.createdAt)}
                    {a.role !== 'root' && ` · права: ${a.perms.length ? a.perms.map((p) => PERM_TITLES[p]?.split(' ')[0] || p).join(', ') : 'нет'}`}
                  </p>
                </div>
                {a.role !== 'root' && (
                  <div className="flex gap-1.5">
                    <Btn onClick={() => { setEdit(a); setEditPerms([...a.perms]); }}><KeyRound className="w-3.5 h-3.5" /> Права</Btn>
                    <Btn variant="danger" onClick={() => void del(a)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Профиль */}
      <Card>
        <CardHead title="Профиль: смена своего пароля" icon={<ShieldCheck className="w-4 h-4" />} />
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <Field label="Текущий пароль">
            <input className={inputCls} type="password" value={profile.oldPassword} onChange={(e) => setProfile({ ...profile, oldPassword: e.target.value })} />
          </Field>
          <Field label="Новый пароль" hint="минимум 8 символов">
            <input className={inputCls} type="password" value={profile.newPassword} onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Btn variant="primary" onClick={() => void saveProfile()} disabled={busy === 'profile'}>
              {busy === 'profile' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Сменить пароль
            </Btn>
          </div>
        </div>
      </Card>

      {/* Бэкапы */}
      <Card>
        <CardHead title="Резервная копия" icon={<Download className="w-4 h-4" />}
          sub="настройки, ключи клиентов и учётные записи" />
        <div className="p-4 flex flex-wrap items-center gap-2">
          <a href="/api/backup" download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors">
            <Download className="w-3.5 h-3.5" /> Скачать бэкап (.json)
          </a>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-950/60 border border-slate-800 text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Восстановить из файла
            <input type="file" accept="application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && void restore(e.target.files[0])} />
          </label>
          <span className="text-[11px] text-slate-500">Также копируйте файл <code className="font-mono text-emerald-300/80">data/panel/db.json</code> целиком</span>
        </div>
      </Card>

      {/* Модалка добавления */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Новый администратор">
        <div className="space-y-3">
          <Field label="Логин" hint="3-32 символа: латиница, цифры, _ . -">
            <input className={inputCls} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="operator" autoFocus />
          </Field>
          <Field label="Пароль" hint="минимум 8 символов">
            <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div>
            <p className="text-[11px] font-medium text-slate-400 mb-2">Права доступа</p>
            <div className="space-y-1.5">
              {ALL_PERMS.map((p) => (
                <label key={p} className="flex items-center gap-2.5 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 cursor-pointer hover:border-slate-600 transition-colors">
                  <input type="checkbox" className="accent-emerald-500" checked={form.perms.includes(p)}
                    onChange={(e) => setForm({ ...form, perms: e.target.checked ? [...form.perms, p] : form.perms.filter((x) => x !== p) })} />
                  <span className="text-[12.5px] text-slate-300">{PERM_TITLES[p]}</span>
                </label>
              ))}
            </div>
          </div>
          <Btn variant="primary" className="w-full py-2.5" onClick={() => void createAdmin()} disabled={busy === 'add'}>
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Создать администратора
          </Btn>
        </div>
      </Modal>

      {/* Модалка прав */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Права: ${edit?.username || ''}`}>
        {edit && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              {ALL_PERMS.map((p) => (
                <label key={p} className="flex items-center gap-2.5 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 cursor-pointer hover:border-slate-600 transition-colors">
                  <input type="checkbox" className="accent-emerald-500" checked={editPerms.includes(p)}
                    onChange={(e) => setEditPerms(e.target.checked ? [...editPerms, p] : editPerms.filter((x) => x !== p))} />
                  <span className="text-[12.5px] text-slate-300">{PERM_TITLES[p]}</span>
                </label>
              ))}
            </div>
            <Field label="Сбросить пароль" hint="оставьте пустым, чтобы не менять">
              <input className={inputCls} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </Field>
            <Btn variant="primary" className="w-full py-2.5" onClick={() => void saveEdit()} disabled={busy === 'edit'}>
              {busy === 'edit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Сохранить
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
