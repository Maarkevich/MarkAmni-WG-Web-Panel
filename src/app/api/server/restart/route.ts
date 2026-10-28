import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as awgctl from '@/lib/awg/awgctl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function run(bin: string, args: string[]): Promise<{ e: Error | null; out: string }> {
  return new Promise((r) => execFile(bin, args, { timeout: 25000 }, (e, so, se) => r({ e, out: (so || '') + (se || '') })));
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'server');
  if (isGuardFail(g)) return g;
  const s = store.get().settings.server;
  if (!awgctl.runtime.awgInstalled) return json({ ok: false, demo: true, message: 'Утилиты AWG не установлены на этом сервере' });
  await run('awg-quick', ['down', s.iface]);
  const up = await run('awg-quick', ['up', s.iface]);
  await awgctl.detect();
  store.audit('server.restart', g.user.username);
  return json({ ok: !up.e, message: up.e ? 'Ошибка: ' + up.out.slice(-300) : `Интерфейс ${s.iface} перезапущен` });
}
