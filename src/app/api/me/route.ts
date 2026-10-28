import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req);
  if (isGuardFail(g)) return g;
  return json({ user: g.user });
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req);
  if (isGuardFail(g)) return g;
  const { oldPassword, newPassword } = (await req.json().catch(() => ({}))) as { oldPassword?: string; newPassword?: string };
  if (!newPassword || String(newPassword).length < 8) return err('Новый пароль должен быть не короче 8 символов');
  const db = store.get();
  const admin = db.admins.find((a) => a.id === g.user.id);
  if (!admin) return err('Пользователь не найден', 404);
  if (!bcrypt.compareSync(String(oldPassword || ''), admin.passHash)) return err('Текущий пароль неверен', 401);
  admin.passHash = bcrypt.hashSync(String(newPassword), 10);
  store.save();
  store.audit('auth.password', admin.username);
  return json({ ok: true });
}
