import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import { generateKeypair } from '@/lib/awg/keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SERVER_FIELDS = ['iface', 'wanIface', 'endpoint', 'port', 'subnet', 'serverIp', 'dns', 'mtu', 'keepalive', 'defaultRouting', 'autoDisableLimit', 'autoDisableExpired'] as const;

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'server');
  if (isGuardFail(g)) return g;
  const db = store.get();
  const s = db.settings.server;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  for (const f of SERVER_FIELDS) {
    if (body[f] !== undefined) (s as unknown as Record<string, unknown>)[f] = body[f];
  }
  if (s.port) s.port = Number(s.port) || s.port;
  if (s.mtu) s.mtu = Number(s.mtu) || s.mtu;
  if (s.keepalive !== undefined) s.keepalive = Number(s.keepalive) || 0;
  if (body.rotKeys) {
    // Ротация ключей сервера — все клиенты должны получить новые конфиги
    const kp = await generateKeypair();
    s.privateKey = kp.privateKey;
    s.publicKey = kp.publicKey;
    store.save();
    store.audit('server.rotkeys', g.user.username);
    return json({ ok: true, message: 'Ключи сервера заменены! Раздайте клиентам новые конфиги.', server: s });
  }
  store.save();
  store.audit('server.settings', g.user.username, JSON.stringify({ endpoint: s.endpoint, port: s.port }));
  return json({ ok: true, server: s });
}
