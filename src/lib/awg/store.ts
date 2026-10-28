// ============================================
// store.ts — JSON-база данных панели (атомарная запись)
// Выбрана вместо ORM для максимальной портируемости на VPS:
// ноль зависимостей, человекочитаемый бэкап, атомарная запись.
// ============================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Db, ObfParams } from './types';

export const DATA_DIR = process.env.PANEL_DATA_DIR || path.join(process.cwd(), 'data', 'panel');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, 'jwt.secret');

let db: Db | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Next.js (Turbopack) может дублировать модули между роут-бандлами —
// singleton-состояние базы храним в globalThis, чтобы все экземпляры
// модуля видели одну и ту же базу (иначе записи затираются).
const g = globalThis as unknown as { __awgDb?: Db; __awgSaveTimer?: ReturnType<typeof setTimeout> | null };

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

export function randomHex(n = 32): string {
  return crypto.randomBytes(n).toString('hex');
}

export function defaultObf(version: '1.5' | '2.0' | '3.1' = '3.1'): ObfParams {
  const obf: ObfParams = {
    version,
    // Jc — мусорные пакеты: 1..128, рекомендуется 4..12
    Jc: 4 + Math.floor(Math.random() * 9),
    // Jmin/Jmax — размер мусора, Jmax > Jmin < 1280
    Jmin: 8 + Math.floor(Math.random() * 32),
    Jmax: 80 + Math.floor(Math.random() * 60),
    // S1..S2 — префиксы Init/Response (15..150), S1 + 56 !== S2
    S1: 15 + Math.floor(Math.random() * 136),
    S2: 0,
    S3: '',
    S4: '',
    // H1..H4 — уникальные магические заголовки (для 2.0/3.1 — диапазоны без пересечений)
    H1: '', H2: '', H3: '', H4: '',
    // I1..I5 — CPS-сигнатуры (имитация QUIC/DNS и др.), только 2.0/3.1
    I1: '', I2: '', I3: '', I4: '', I5: '',
    // 3.1: шифрование заголовков + паддинг содержимого + таймеры (опционально)
    HeaderProtectionKey: '',
    ContentPaddingAddition: '',
    RekeyAfterTime: '',
    RekeyTimeout: '',
    RejectAfterTime: '',
    KeepaliveTimeout: '',
    MaxHandshakeAttempts: '',
    extra: ''
  };
  do {
    obf.S2 = 15 + Math.floor(Math.random() * 136);
  } while (obf.S1 + 56 === obf.S2 || obf.S1 === obf.S2);
  return obf;
}

export function isDemo(): boolean {
  return process.env.PANEL_DEMO === '1';
}

function defaults(): Db {
  return {
    settings: {
      panelName: 'AmneziaWG Panel',
      server: {
        iface: 'awg0',
        wanIface: 'eth0',
        endpoint: (process.env.SERVER_IP || '').trim(),
        port: Number(process.env.VPN_PORT || 51820),
        subnet: '10.8.1.0/24',
        serverIp: '10.8.1.1/24',
        dns: '1.1.1.1, 1.0.0.1',
        mtu: 1280,
        keepalive: 25,
        privateKey: '',
        publicKey: '',
        obf: defaultObf('3.1'),
        defaultRouting: 'full',
        autoDisableLimit: true,
        autoDisableExpired: true
      },
      telegram: {
        token: '',
        bound: [], // { id, name }
        notify: { created: true, expired: true, limit: true, disabled: true }
      }
    },
    admins: [],
    clients: [],
    audit: [],
    traffic: {},
    meta: { createdAt: new Date().toISOString(), demoSeed: false }
  };
}

export function load(): Db {
  ensureDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Db;
    } catch (e) {
      console.error('[store] Ошибка чтения db.json, создаю резервную копию:', (e as Error).message);
      try { fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt.' + Date.now()); } catch { /* noop */ }
      db = defaults();
    }
  } else {
    db = defaults();
    persistNow();
  }
  // миграции / защита от отсутствующих полей
  const d = defaults();
  db.settings = db.settings || d.settings;
  db.settings.server = { ...d.settings.server, ...db.settings.server };
  db.settings.server.obf = { ...d.settings.server.obf, ...db.settings.server.obf };
  db.settings.telegram = { ...d.settings.telegram, ...db.settings.telegram };
  db.admins = Array.isArray(db.admins) ? db.admins : [];
  db.clients = Array.isArray(db.clients) ? db.clients : [];
  db.audit = Array.isArray(db.audit) ? db.audit : [];
  db.traffic = db.traffic || {};
  g.__awgDb = db;
  return db;
}

export function get(): Db {
  if (db === null && g.__awgDb) db = g.__awgDb; // подхватить из globalThis (другой экземпляр модуля)
  if (!db) load();
  return db!;
}

export function persistNow() {
  ensureDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

// Отложенная запись (не чаще раза в 400мс) — чтобы не убить диск VPS
export function save() {
  if (saveTimer || g.__awgSaveTimer) return;
  const timer = setTimeout(() => {
    saveTimer = null;
    g.__awgSaveTimer = null;
    try { persistNow(); } catch (e) { console.error('[store] Ошибка сохранения:', (e as Error).message); }
  }, 400);
  saveTimer = timer;
  g.__awgSaveTimer = timer;
}

export function jwtSecret(): string {
  ensureDir();
  if (!fs.existsSync(SECRET_FILE)) {
    fs.writeFileSync(SECRET_FILE, randomHex(48), { mode: 0o600 });
  }
  return fs.readFileSync(SECRET_FILE, 'utf8').trim();
}

// -------- Аудит --------
export function audit(action: string, actor: string, details = '') {
  const d = get();
  d.audit.unshift({ ts: new Date().toISOString(), actor: actor || 'system', action, details: String(details).slice(0, 300) });
  if (d.audit.length > 600) d.audit.length = 600;
  save();
}

// -------- Суточный трафик --------
export function addTraffic(rx: number, tx: number) {
  if (!rx && !tx) return;
  const d = get();
  const day = new Date().toISOString().slice(0, 10);
  if (!d.traffic[day]) d.traffic[day] = { rx: 0, tx: 0 };
  d.traffic[day].rx += rx;
  d.traffic[day].tx += tx;
  // храним 90 дней
  const keys = Object.keys(d.traffic).sort();
  while (keys.length > 90) delete d.traffic[keys.shift() as string];
  save();
}
