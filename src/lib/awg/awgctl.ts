// ============================================
// awgctl.ts — управление AmneziaWG на сервере
// (применение конфига, статистика, статус, лимиты)
// ============================================
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import * as store from './store';
import * as conf from './conf';
import { generateKeypair } from './keys';
import type { Client } from './types';

export const AWG_CONF_DIR = '/etc/amnezia/amneziawg';

export const runtime = {
  demo: true,          // true, если утилиты AWG не найдены (режим конфигуратора)
  awgInstalled: false,
  ifaceUp: false,
  toolVersion: '',
  moduleVersion: '',
  detectedIp: '',
  lastApplyMessage: ''
};

function sh(bin: string, args: string[], timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message || '').toString().slice(0, 400)));
      resolve(stdout.toString());
    });
  });
}

export function detectPrimaryIp(): string {
  if (process.env.SERVER_IP) return process.env.SERVER_IP;
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

export async function detect() {
  runtime.awgInstalled = false;
  runtime.ifaceUp = false;
  try {
    await sh('which', ['awg']);
    runtime.awgInstalled = true;
  } catch {
    try {
      await sh('which', ['wg']);
      runtime.awgInstalled = true; // хотя бы wg-tools: ключи генерим, но интерфейс awg не поднять
    } catch { /* noop */ }
  }
  try { runtime.toolVersion = (await sh('awg', ['--version'], 5000)).split('\n')[0].trim(); } catch { runtime.toolVersion = ''; }
  try {
    const out = await sh('modinfo', ['-F', 'version', 'amneziawg'], 5000);
    runtime.moduleVersion = out.trim();
  } catch { runtime.moduleVersion = ''; }
  try {
    await sh('ip', ['link', 'show', store.get().settings.server.iface || 'awg0'], 4000);
    runtime.ifaceUp = true;
  } catch { /* noop */ }
  runtime.demo = !runtime.awgInstalled;
  runtime.detectedIp = detectPrimaryIp();
  return runtime;
}

// Записать конфиг и перезапустить интерфейс
export async function applyConfig() {
  const db = store.get();
  const s = db.settings.server;
  const text = conf.buildServerConf(db);
  fs.mkdirSync(AWG_CONF_DIR, { recursive: true });
  const file = path.join(AWG_CONF_DIR, `${s.iface || 'awg0'}.conf`);
  fs.writeFileSync(file, text, { mode: 0o600 });
  store.audit('server.apply', 'system', file);

  if (!runtime.awgInstalled) {
    runtime.lastApplyMessage = `Конфиг сохранён в ${file}. Утилиты AWG не найдены — установите модуль ядра AmneziaWG (install.sh или инструкция во вкладке «Сервер»).`;
    return { ok: true, demo: true, message: runtime.lastApplyMessage, file };
  }
  try { await sh('systemctl', ['enable', `awg-quick@${s.iface}`], 10000); } catch { /* noop */ }
  try { await sh('awg-quick', ['down', s.iface], 20000); } catch { /* noop */ }
  try {
    await sh('awg-quick', ['up', s.iface], 25000);
    await detect();
    return { ok: true, message: `Конфиг применён: интерфейс ${s.iface} перезапущен (${file})`, file };
  } catch (e) {
    await detect();
    return { ok: false, message: 'Ошибка awg-quick: ' + (e as Error).message, file };
  }
}

// Быстрая синхронизация пиров без разрыва соединений (awg syncconf)
export async function syncPeers() {
  const db = store.get();
  if (!runtime.awgInstalled || !runtime.ifaceUp) return;
  try {
    const text = conf.buildServerConf(db);
    const tmp = path.join(store.DATA_DIR, '.syncconf.tmp');
    fs.writeFileSync(tmp, text, { mode: 0o600 });
    await sh('awg', ['syncconf', db.settings.server.iface, tmp], 10000);
    fs.unlinkSync(tmp);
  } catch (e) {
    console.error('[awgctl] syncconf:', (e as Error).message);
  }
}

function fmtAgo(sec: number): string {
  if (sec < 60) return `${sec} сек. назад`;
  if (sec < 3600) return `${Math.floor(sec / 60)} мин. назад`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч. назад`;
  return `${Math.floor(sec / 86400)} дн. назад`;
}

// Демо-режим (нет утилит AWG): имитация живого трафика
function demoSimulate(db: { clients: Client[] }) {
  const clients = db.clients.filter((c) => c.enabled);
  if (!clients.length) return;
  for (const c of clients) {
    if (!c.usage) c.usage = { rx: 0, tx: 0, online: false, lastHandshake: '—' };
    if (Math.random() < 0.25) continue; // часть «спит»
    c.usage.rx = (c.usage.rx || 0) + Math.floor(Math.random() * 900000) + 40000;
    c.usage.tx = (c.usage.tx || 0) + Math.floor(Math.random() * 260000) + 8000;
    c.usage.online = true;
    c.usage.lastHandshake = `${Math.floor(Math.random() * 40) + 2} сек. назад`;
  }
  store.save();
}

// Парсинг `awg show <iface> dump`
export async function fetchStats() {
  const db = store.get();
  let changed = false;
  if (!runtime.awgInstalled) {
    if (store.isDemo()) demoSimulate(db);
    return;
  }
  let out = '';
  try {
    out = await sh('awg', ['show', db.settings.server.iface, 'dump'], 10000);
  } catch {
    await detect();
    return;
  }
  const lines = out.trim().split('\n').slice(1);
  const byPub: Record<string, { handshake: number; rx: number; tx: number }> = {};
  for (const line of lines) {
    const p = line.split('\t');
    if (p.length < 7) continue;
    byPub[p[0]] = {
      handshake: parseInt(p[4], 10) || 0,
      rx: parseInt(p[5], 10) || 0,
      tx: parseInt(p[6], 10) || 0
    };
  }
  const now = Math.floor(Date.now() / 1000);
  for (const c of db.clients) {
    const st = byPub[c.publicKey];
    if (!st) continue;
    if (st.rx > (c.usage?.rx || 0)) { c.usage = c.usage || { rx: 0, tx: 0, online: false, lastHandshake: '—' }; c.usage.rx = st.rx; changed = true; }
    if (st.tx > (c.usage?.tx || 0)) { c.usage = c.usage || { rx: 0, tx: 0, online: false, lastHandshake: '—' }; c.usage.tx = st.tx; changed = true; }
    const online = st.handshake > 0 && now - st.handshake < 180;
    const hs = st.handshake > 0 ? fmtAgo(now - st.handshake) : '—';
    if (c.usage?.online !== online || c.usage?.lastHandshake !== hs) {
      c.usage = c.usage || { rx: 0, tx: 0, online: false, lastHandshake: '—' };
      c.usage.online = online;
      c.usage.lastHandshake = hs;
      changed = true;
    }
  }
  await detect();
  if (changed) store.save();
}

// Контроль лимитов и сроков; возвращает список событий для Telegram
export async function enforceLimits() {
  const db = store.get();
  const s = db.settings.server;
  const events: { client: Client; reason: string }[] = [];
  const now = Date.now();
  for (const c of db.clients) {
    if (!c.enabled) continue;
    let reason: string | null = null;
    if (s.autoDisableExpired !== false && c.expiresAt && new Date(c.expiresAt + 'T23:59:59') < now) {
      reason = `истёк срок доступа (${c.expiresAt})`;
    }
    if (!reason && s.autoDisableLimit !== false && c.trafficLimitGb > 0) {
      const used = ((c.usage?.rx || 0) + (c.usage?.tx || 0)) / (1024 ** 3);
      if (used >= c.trafficLimitGb) reason = `исчерпан лимит трафика (${used.toFixed(1)} из ${c.trafficLimitGb} ГБ)`;
    }
    if (reason) {
      c.enabled = false;
      if (c.usage) c.usage.online = false;
      events.push({ client: c, reason });
      store.audit('client.autodisable', 'system', `${c.name}: ${reason}`);
    }
  }
  if (events.length) {
    store.save();
    await syncPeers();
  }
  return events;
}

// Генерация и сохранение ключей сервера при первом старте
export async function ensureServerKeys() {
  const db = store.get();
  const s = db.settings.server;
  if (!s.privateKey || !s.publicKey) {
    const kp = await generateKeypair();
    s.privateKey = kp.privateKey;
    s.publicKey = kp.publicKey;
    console.log('[init] Сгенерированы ключи сервера:', s.publicKey.slice(0, 20) + '…');
  }
  if (!s.endpoint || s.endpoint === '127.0.0.1') s.endpoint = runtime.detectedIp !== '127.0.0.1' ? runtime.detectedIp : s.endpoint;
  store.persistNow();
}
