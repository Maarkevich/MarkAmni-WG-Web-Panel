import { NextRequest, NextResponse } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import * as auth from '@/lib/awg/auth';
import * as store from '@/lib/awg/store';
import { clientIp, err, json } from '@/lib/awg/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await bootstrap();
  const ip = clientIp(req);
  if (auth.loginRateLimited(ip)) return err('Слишком много попыток. Подождите минуту.', 429);
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const admin = auth.verify(String(username || ''), String(password || ''));
  if (!admin) {
    store.audit('auth.fail', String(username || '?'), 'IP ' + ip);
    return err('Неверный логин или пароль', 401);
  }
  auth.clearAttempts(ip);
  const token = auth.signToken(admin);
  store.audit('auth.login', admin.username, 'IP ' + ip);
  const res = json({ user: auth.publicUser(admin) });
  res.cookies.set('awg_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 3600
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('awg_token', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
