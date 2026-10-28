import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as awgctl from '@/lib/awg/awgctl';
import { generateKeypair } from '@/lib/awg/keys';
import { MODES } from '@/lib/awg/routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const g = guard(req, 'clients');
  if (isGuardFail(g)) return g;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = store.get();
  const c = db.clients.find((x) => x.id === id);
  if (!c) return err('Клиент не найден', 404);
  for (const f of ['name', 'comment', 'allowedIps', 'expiresAt'] as const) {
    if (body[f] !== undefined) c[f] = String(body[f]).trim();
  }
  if (body.trafficLimitGb !== undefined) c.trafficLimitGb = Number(body.trafficLimitGb) || 0;
  if (body.mode && MODES[body.mode as keyof typeof MODES]) c.mode = body.mode as typeof c.mode;
  if (body.enabled !== undefined) c.enabled = !!body.enabled;
  if (body.rotKeys) {
    const kp = await generateKeypair();
    c.privateKey = kp.privateKey; c.publicKey = kp.publicKey; c.presharedKey = kp.presharedKey;
    store.audit('client.rotkeys', g.user.username, c.name);
  }
  store.save();
  store.audit('client.update', g.user.username, c.name);
  await awgctl.syncPeers();
  return json({ ok: true, client: c });
}

// Переключение вкл/выкл
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const g = guard(req, 'clients');
  if (isGuardFail(g)) return g;
  const { id } = await params;
  const db = store.get();
  const c = db.clients.find((x) => x.id === id);
  if (!c) return err('Клиент не найден', 404);
  c.enabled = !c.enabled;
  if (c.usage) c.usage.online = false;
  store.save();
  store.audit(c.enabled ? 'client.enable' : 'client.disable', g.user.username, c.name);
  await awgctl.syncPeers();
  return json({ ok: true, client: c });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const g = guard(req, 'clients');
  if (isGuardFail(g)) return g;
  const { id } = await params;
  const db = store.get();
  const idx = db.clients.findIndex((x) => x.id === id);
  if (idx < 0) return err('Клиент не найден', 404);
  const [c] = db.clients.splice(idx, 1);
  store.save();
  store.audit('client.delete', g.user.username, c.name);
  await awgctl.syncPeers();
  return json({ ok: true });
}
