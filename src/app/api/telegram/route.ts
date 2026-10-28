import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as telegram from '@/lib/awg/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'telegram');
  if (isGuardFail(g)) return g;
  const t = store.get().settings.telegram;
  const st = telegram.status();
  return json({
    configured: st.configured,
    running: st.running,
    hasCode: st.hasCode,
    tokenMasked: t.token ? t.token.slice(0, 8) + '••••••' + t.token.slice(-4) : '',
    bound: t.bound,
    notify: t.notify
  });
}

export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'telegram');
  if (isGuardFail(g)) return g;
  const t = store.get().settings.telegram;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');

  if (action === 'save') {
    const token = String(body.token || '').trim();
    if (token && !/^\d+:[\w-]{20,}$/.test(token)) return err('Токен выглядит некорректно. Формат: 123456789:AA...');
    t.token = token;
    store.save();
    store.audit('telegram.save', g.user.username, token ? 'токен обновлён' : 'токен удалён');
    if (token) telegram.start(token); else telegram.stop();
    return json({ ok: true, message: token ? 'Токен сохранён, бот запускается…' : 'Бот отключён' });
  }

  if (action === 'test') {
    if (!telegram.status().running) return err('Бот не запущен. Сохраните токен.');
    telegram.notify(true, '✅ Тестовое уведомление от панели AmneziaWG');
    return json({ ok: true, message: 'Тестовое сообщение отправлено всем привязанным администраторам' });
  }

  if (action === 'link') {
    const code = telegram.generateLinkCode();
    store.audit('telegram.link', g.user.username, code);
    return json({ ok: true, code });
  }

  if (action === 'unbind') {
    t.bound = t.bound.filter((u) => String(u.id) !== String(body.userId));
    store.save();
    store.audit('telegram.unbind', g.user.username, String(body.userId));
    return json({ ok: true });
  }

  if (action === 'notify') {
    t.notify = { ...t.notify, ...(body.notify as Record<string, boolean> || {}) };
    store.save();
    return json({ ok: true, notify: t.notify });
  }

  return err('Неизвестное действие');
}
