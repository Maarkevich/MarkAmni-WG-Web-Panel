import { NextRequest, NextResponse } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as awgctl from '@/lib/awg/awgctl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Скачивание бэкапа
export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'admins');
  if (isGuardFail(g)) return g;
  const db = store.get();
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), settings: db.settings, admins: db.admins, clients: db.clients }, null, 2);
  return new NextResponse(payload, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="awg-panel-backup.json"'
    }
  });
}

// Восстановление из бэкапа
export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'admins');
  if (isGuardFail(g)) return g;
  const data = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || !data.settings || !Array.isArray(data.clients)) return err('Неверный формат файла бэкапа');
  const db = store.get();
  db.settings = data.settings as typeof db.settings;
  if (Array.isArray(data.admins) && data.admins.length) db.admins = data.admins as typeof db.admins;
  db.clients = data.clients as typeof db.clients;
  for (const c of db.clients) if (!c.usage) c.usage = { rx: 0, tx: 0, online: false, lastHandshake: '—' };
  store.save();
  store.audit('backup.restore', g.user.username, `${db.clients.length} клиентов`);
  void awgctl.syncPeers();
  return json({ ok: true, message: `Бэкап восстановлен: клиентов ${db.clients.length}` });
}
