import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import { PERMS } from '@/lib/awg/auth';
import type { Perm } from '@/lib/awg/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const g = guard(req, 'admins');
  if (isGuardFail(g)) return g;
  const { id } = await params;
  const db = store.get();
  const a = db.admins.find((x) => x.id === id);
  if (!a) return err('Администратор не найден', 404);
  if (a.role === 'root' && g.user.role !== 'root') return err('Нельзя изменять главного администратора', 403);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.password) {
    if (String(body.password).length < 8) return err('Пароль не короче 8 символов');
    a.passHash = bcrypt.hashSync(String(body.password), 10);
    store.audit('admin.resetpass', g.user.username, a.username);
  }
  if (Array.isArray(body.perms) && a.role !== 'root') {
    a.perms = (body.perms as string[]).filter((p) => PERMS.includes(p as Perm)) as Perm[];
  }
  store.save();
  return json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const g = guard(req, 'admins');
  if (isGuardFail(g)) return g;
  const { id } = await params;
  const db = store.get();
  const a = db.admins.find((x) => x.id === id);
  if (!a) return err('Не найден', 404);
  if (a.role === 'root') return err('Главного администратора удалить нельзя');
  db.admins = db.admins.filter((x) => x.id !== id);
  store.save();
  store.audit('admin.delete', g.user.username, a.username);
  return json({ ok: true });
}
