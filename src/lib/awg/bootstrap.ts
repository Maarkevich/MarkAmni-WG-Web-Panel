// ============================================
// bootstrap.ts — однократная инициализация панели
// (вызывается из API-роутов; идемпотентен)
// ============================================
import * as store from './store';
import { bootstrapRoot } from './auth';
import { detectTools } from './keys';
import * as awgctl from './awgctl';
import { generate } from './obfuscation';
import { start as startTelemetry, snapshot } from './telemetry';
import { start as startTg } from './telegram';
import crypto from 'crypto';
import type { Client } from './types';

const g = globalThis as unknown as { __awgBoot?: Promise<void> };

async function seedDemoClients() {
  const db = store.get();
  if (!store.isDemo() || db.meta.demoSeed || db.clients.length) return;
  db.meta.demoSeed = true;
  const names = [
    ['iPhone-Алексей', 'Личный телефон'],
    ['Pixel-Ольга', 'Телефон жены'],
    ['Ноутбук-Office', 'Рабочий ноутбук']
  ];
  for (let i = 0; i < names.length; i++) {
    const [name, comment] = names[i];
    const priv = crypto.randomBytes(32);
    priv[0] &= 248; priv[31] &= 127; priv[31] |= 64;
    db.clients.push({
      id: crypto.randomUUID(),
      name,
      comment,
      ip: `10.8.1.${i + 2}/32`,
      mode: 'full',
      allowedIps: '',
      privateKey: priv.toString('base64'),
      publicKey: crypto.randomBytes(32).toString('base64'),
      presharedKey: crypto.randomBytes(32).toString('base64'),
      enabled: true,
      trafficLimitGb: i === 2 ? 50 : 0,
      expiresAt: i === 1 ? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) : '',
      createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      usage: { rx: Math.floor(Math.random() * 4e9), tx: Math.floor(Math.random() * 1e9), online: i < 2, lastHandshake: i < 2 ? '12 сек. назад' : '—' }
    } satisfies Client);
  }
  store.persistNow();
  store.audit('demo.seed', 'system', 'Добавлены демо-клиенты (PANEL_DEMO=1)');
}

export function bootstrap(): Promise<void> {
  if (g.__awgBoot) return g.__awgBoot;
  g.__awgBoot = (async () => {
    try {
      store.load();
      bootstrapRoot();
      await detectTools();
      await awgctl.detect();
      await awgctl.ensureServerKeys();
      const db = store.get();
      if (!db.settings.server.obf.H1) db.settings.server.obf = generate(db.settings.server.obf.version || '3.1');
      if (!db.settings.server.endpoint || db.settings.server.endpoint === '127.0.0.1') {
        db.settings.server.endpoint = awgctl.runtime.detectedIp !== '127.0.0.1' ? awgctl.runtime.detectedIp : db.settings.server.endpoint;
      }
      store.persistNow();
      await seedDemoClients();

      startTelemetry(2000);
      await awgctl.fetchStats();
      const gi = globalThis as unknown as { __awgTimers?: { stats?: ReturnType<typeof setInterval>; limits?: ReturnType<typeof setInterval> } };
      if (!gi.__awgTimers) gi.__awgTimers = {};
      if (!gi.__awgTimers.stats) {
        gi.__awgTimers.stats = setInterval(() => { void awgctl.fetchStats().catch(() => {}); }, 30000);
      }
      if (!gi.__awgTimers.limits) {
        gi.__awgTimers.limits = setInterval(() => {
          void (async () => {
            try {
              const events = await awgctl.enforceLimits();
              for (const ev of events) {
                const t = store.get().settings.telegram;
                const { notify } = await import('./telegram');
                notify(t.notify.expired || t.notify.limit, `⛔️ Клиент *${ev.client.name}* автоматически отключён: ${ev.reason}`);
              }
            } catch (e) { console.error('[jobs]', (e as Error).message); }
          })();
        }, 60000);
      }
      if (store.get().settings.telegram.token) startTg();
      snapshot();
      console.log('[bootstrap] Панель инициализирована. Режим:', awgctl.runtime.demo ? 'конфигуратора (демо)' : 'полный (AWG tools)');
    } catch (e) {
      console.error('[bootstrap] Ошибка инициализации:', (e as Error).message);
      g.__awgBoot = undefined; // позволить повторную попытку
    }
  })();
  return g.__awgBoot;
}
