import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as awgctl from '@/lib/awg/awgctl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req);
  if (isGuardFail(g)) return g;
  const db = store.get();
  const s = db.settings;
  return json({
    panelName: s.panelName,
    server: {
      ...s.server,
      obf: { ...s.server.obf }
    },
    runtime: {
      ...awgctl.runtime,
      interface: s.server.iface
    },
    role: g.user.role,
    perms: g.user.role === 'root' ? ['dashboard', 'clients', 'server', 'routing', 'telegram', 'admins', 'logs'] : g.user.perms,
    demo: store.isDemo()
  });
}
