import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json } from '@/lib/awg/api';
import { snapshot } from '@/lib/awg/telemetry';
import * as store from '@/lib/awg/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'dashboard');
  if (isGuardFail(g)) return g;
  const db = store.get();
  const t = snapshot();
  const enabled = db.clients.filter((c) => c.enabled);
  const online = enabled.filter((c) => c.usage?.online);
  const totalRx = db.clients.reduce((a, c) => a + (c.usage?.rx || 0), 0);
  const totalTx = db.clients.reduce((a, c) => a + (c.usage?.tx || 0), 0);
  const topClients = [...db.clients]
    .sort((a, b) => ((b.usage?.rx || 0) + (b.usage?.tx || 0)) - ((a.usage?.rx || 0) + (a.usage?.tx || 0)))
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, rx: c.usage?.rx || 0, tx: c.usage?.tx || 0, online: !!(c.enabled && c.usage?.online) }));
  return json({
    telemetry: t,
    stats: {
      totalPeers: db.clients.length,
      enabled: enabled.length,
      online: online.length,
      totalRx, totalTx,
      awgTotalRx: t.net?.awgTotalRx || 0,
      awgTotalTx: t.net?.awgTotalTx || 0
    },
    topClients,
    events: db.audit.slice(0, 8),
    trafficToday: db.traffic[new Date().toISOString().slice(0, 10)] || { rx: 0, tx: 0 }
  });
}
