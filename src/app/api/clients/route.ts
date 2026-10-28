import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as awgctl from '@/lib/awg/awgctl';
import * as conf from '@/lib/awg/conf';
import { generateKeypair } from '@/lib/awg/keys';
import { MODES } from '@/lib/awg/routing';
import { notify } from '@/lib/awg/telegram';
import type { Client } from '@/lib/awg/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'clients');
  if (isGuardFail(g)) return g;
  const db = store.get();
  return json({ clients: db.clients });
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'clients');
  if (isGuardFail(g)) return g;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = store.get();
  const name = String(body.name || '').trim();
  if (!name) return err('Укажите имя клиента');
  if (db.clients.some((c) => c.name.toLowerCase() === name.toLowerCase())) return err('Клиент с таким именем уже есть');
  const octet = conf.nextIp(db);
  if (!octet) return err('Подсеть заполнена');
  const kp = await generateKeypair();
  const client: Client = {
    id: crypto.randomUUID(),
    name,
    comment: String(body.comment || '').trim(),
    ip: `${conf.ipPrefix(db.settings.server.subnet)}.${octet}/32`,
    mode: MODES[body.mode as keyof typeof MODES] ? (body.mode as Client['mode']) : 'full',
    allowedIps: String(body.allowedIps || '').trim(),
    privateKey: kp.privateKey,
    publicKey: kp.publicKey,
    presharedKey: kp.presharedKey,
    enabled: body.enabled !== false,
    trafficLimitGb: Number(body.trafficLimitGb) || 0,
    expiresAt: String(body.expiresAt || '').trim(),
    createdAt: new Date().toISOString(),
    usage: { rx: 0, tx: 0, online: false, lastHandshake: '—' }
  };
  db.clients.push(client);
  store.save();
  store.audit('client.create', g.user.username, name);
  await awgctl.syncPeers();
  notify(db.settings.telegram.notify.created, `🆕 Создан клиент *${name}* (${client.ip})`);
  return json({ ok: true, client });
}
