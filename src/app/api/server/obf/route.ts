import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as obf from '@/lib/awg/obfuscation';
import type { AwgVersion } from '@/lib/awg/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'server');
  if (isGuardFail(g)) return g;
  const db = store.get();
  const s = db.settings.server;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Смена версии протокола с генерацией нового набора параметров
  if (body.version && !body.obf) {
    const version = String(body.version);
    if (!['1.5', '2.0', '3.1'].includes(version)) return err('Неизвестная версия протокола');
    s.obf = obf.generate(version as AwgVersion);
    store.save();
    store.audit('server.obf.preset', g.user.username, `AWG ${version}`);
    return json({ ok: true, obf: s.obf, message: `Сгенерирован набор параметров для AmneziaWG ${version}` });
  }

  // Случайные пресеты маскировки: standard / light / max
  if (body.preset) {
    const preset = String(body.preset);
    const o = obf.generate(s.obf.version);
    if (preset === 'light') {
      o.Jc = 2 + Math.floor(Math.random() * 3);
      o.Jmin = 30 + Math.floor(Math.random() * 20);
      o.Jmax = o.Jmin + 30 + Math.floor(Math.random() * 40);
    } else if (preset === 'max') {
      o.Jc = 6 + Math.floor(Math.random() * 5);
      o.Jmin = 60 + Math.floor(Math.random() * 40);
      o.Jmax = Math.min(1279, o.Jmin + 150 + Math.floor(Math.random() * 300));
    }
    o.MTU = s.obf.MTU || o.MTU;
    s.obf = o;
    store.save();
    store.audit('server.obf.randomize', g.user.username, preset);
    const names: Record<string, string> = { standard: 'Стандартный', light: 'Лёгкий (минимальный оверхед)', max: 'Максимальная маскировка' };
    return json({ ok: true, obf: s.obf, message: `Сгенерированы новые параметры (${names[preset] || preset})` });
  }

  // Сохранение отредактированных параметров
  if (body.obf) {
    const next = { ...s.obf, ...(body.obf as Record<string, unknown>) } as typeof s.obf;
    const errors = obf.validate(next);
    if (errors.length) return err(errors.join('; '));
    s.obf = next;
    store.save();
    store.audit('server.obf.save', g.user.username, `AWG ${s.obf.version}`);
    return json({ ok: true, obf: s.obf, message: 'Параметры обфускации сохранены' });
  }

  return err('Нечего сохранять');
}
