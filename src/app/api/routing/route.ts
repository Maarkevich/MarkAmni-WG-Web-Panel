import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as routing from '@/lib/awg/routing';
import type { RoutingMode } from '@/lib/awg/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'routing');
  if (isGuardFail(g)) return g;
  return json({
    mode: store.get().settings.server.defaultRouting,
    ru: routing.ruInfo(),
    modes: routing.MODES
  });
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'routing');
  if (isGuardFail(g)) return g;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Обновление списка geoip:ru
  if (body.action === 'ru-update') {
    try {
      const r = await routing.updateRuList();
      return json({ ok: true, ru: routing.ruInfo(), message: `Список geoip:ru обновлён (IPv4: ${r.v4}${r.v6 ? ', IPv6: ' + r.v6 : ''})` });
    } catch (e) {
      return err('Не удалось обновить список: ' + (e as Error).message, 500);
    }
  }

  // Смена режима по умолчанию
  const mode = String(body.mode || 'full') as RoutingMode;
  if (!routing.MODES[mode]) return err('Неизвестный режим');
  const db = store.get();
  db.settings.server.defaultRouting = mode;
  store.save();
  store.audit('routing.mode', g.user.username, routing.MODES[mode].title);
  return json({ ok: true, mode });
}
