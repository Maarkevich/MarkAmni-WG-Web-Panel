import { NextRequest } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import { PERMS, publicUser } from '@/lib/awg/auth';
import type { Perm } from '@/lib/awg/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'admins');
  if (isGuardFail(g)) return g;
  const db = store.get();
  return json({
    admins: db.admins.map((a) => ({ id: a.id, username: a.username, role: a.role, perms: a.role === 'root' ? PERMS : a.perms, createdAt: a.createdAt })),
    perms: PERMS
  });
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'admins');
  if (isGuardFail(g)) return g;
  const db = store.get();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) return err('Логин: 3-32 символа (латиница, цифры, _ . -)');
  if (password.length < 8) return err('Пароль не короче 8 символов');
  if (db.admins.some((a) => a.username.toLowerCase() === username.toLowerCase())) return err('Такой логин уже существует');
  const perms = ((body.perms || []) as string[]).filter((p) => PERMS.includes(p as Perm)) as Perm[];
  const admin = {
    id: crypto.randomUUID(),
    username,
    passHash: bcrypt.hashSync(password, 10),
    role: 'admin' as const,
    perms: perms.length ? perms : (['dashboard', 'clients'] as Perm[]),
    createdAt: new Date().toISOString()
  };
  db.admins.push(admin);
  store.save();
  store.audit('admin.create', g.user.username, username);
  return json({ ok: true, admin: publicUser(admin) });
}
