// ============================================
// telegram.ts — бот управления панелью через Telegram
// Реализован на чистом fetch (long polling getUpdates) — без telegraf.
// Команды: /start CODE, /status, /peers, /add, /key, /on, /off, /del, /help
// ============================================
import crypto from 'crypto';
import QRCode from 'qrcode';
import * as store from './store';
import { generateKeypair } from './keys';
import * as awgctl from './awgctl';
import * as conf from './conf';
import { bytes } from './format';
import { snapshot } from './telemetry';
import type { Client } from './types';

const API = 'https://api.telegram.org';

interface TgUpdate {
  update_id: number;
  message?: {
    chat: { id: number | string };
    from?: { id: number | string; first_name?: string; username?: string };
    text?: string;
  };
}

const g = globalThis as unknown as {
  __awgTgState?: { running: boolean; offset: number; controller?: AbortController; boundChatId?: string | number };
};

function state() {
  if (!g.__awgTgState) g.__awgTgState = { running: false, offset: 0 };
  return g.__awgTgState;
}

let linkCode: string | null = null;

const HELP = [
  '*AmneziaWG Panel Bot*',
  '',
  '/status — состояние сервера и телеметрия',
  '/peers — список клиентов',
  '/add Имя — создать клиента и получить конфиг',
  '/key Имя — прислать .conf и QR клиента',
  '/on Имя — включить клиента',
  '/off Имя — отключить клиента',
  '/del Имя — удалить клиента',
  '/help — эта справка'
].join('\n');

function tg() { return store.get().settings.telegram; }

async function call(method: string, body?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const token = tg().token;
  if (!token) return null;
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(35000)
    });
    const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!json.ok) throw new Error(json.description || 'telegram api error');
    return json.result as Record<string, unknown>;
  } catch (e) {
    console.error(`[telegram] ${method}:`, (e as Error).message);
    return null;
  }
}

async function sendMessage(chatId: string | number, text: string, parseMode = 'Markdown') {
  await call('sendMessage', { chat_id: chatId, text: text.slice(0, 4000), parse_mode: parseMode });
}

async function isBound(id: string | number | undefined): Promise<boolean> {
  if (id === undefined) return false;
  return tg().bound.some((u) => String(u.id) === String(id));
}

async function guard(msg: TgUpdate['message']): Promise<boolean> {
  const id = msg?.from?.id ?? msg?.chat?.id;
  if (!(await isBound(id))) {
    if (msg?.chat?.id) await sendMessage(msg.chat.id, '🔒 Отправьте /start КОД (код привязки — в веб-панели, раздел Telegram)');
    return false;
  }
  return true;
}

function findPeer(name: string): Client | null {
  if (!name) return null;
  const db = store.get();
  return db.clients.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null;
}

// Создание пира (общая логика с API)
export async function createPeer(name: string, actor: string): Promise<{ client?: Client; error?: string }> {
  const db = store.get();
  const octet = conf.nextIp(db);
  if (!octet) return { error: 'Подсеть заполнена (254 клиента)' };
  const kp = await generateKeypair();
  const client: Client = {
    id: crypto.randomUUID(),
    name,
    comment: actor === 'telegram' ? 'Создан через Telegram-бота' : '',
    ip: `${conf.ipPrefix(db.settings.server.subnet)}.${octet}/32`,
    mode: db.settings.server.defaultRouting || 'full',
    allowedIps: '',
    privateKey: kp.privateKey,
    publicKey: kp.publicKey,
    presharedKey: kp.presharedKey,
    enabled: true,
    trafficLimitGb: 0,
    expiresAt: '',
    createdAt: new Date().toISOString(),
    usage: { rx: 0, tx: 0, online: false, lastHandshake: '—' }
  };
  db.clients.push(client);
  store.save();
  store.audit('client.create', actor === 'telegram' ? 'telegram' : actor, name);
  await awgctl.syncPeers();
  notify(db.settings.telegram.notify.created, `🆕 Создан клиент *${name}* (${client.ip})`);
  return { client };
}

async function sendClientConfig(chatId: string | number, client: Client) {
  const db = store.get();
  const text = conf.buildClientConf(db, client);
  const vpn = conf.buildVpnLink(db, client);
  await sendDocumentRaw(chatId, Buffer.from(text, 'utf8'), `${client.name}.conf`, `Конфиг AmneziaWG для ${client.name}`);
  const qr = await QRCode.toBuffer(text, { margin: 1, width: 512 });
  await sendPhotoRaw(chatId, qr, 'QR-код для приложений AmneziaVPN / AmneziaWG');
  await sendMessage(chatId, `Ссылка для AmneziaVPN:\n${vpn.slice(0, 3200)}`);
}

async function sendDocumentRaw(chatId: string | number, buf: Buffer, filename: string, caption: string) {
  const token = tg().token;
  if (!token) return;
  try {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('caption', caption);
    fd.append('document', new Blob([new Uint8Array(buf)]), filename);
    await fetch(`${API}/bot${token}/sendDocument`, { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    console.error('[telegram] sendDocument:', (e as Error).message);
  }
}

async function sendPhotoRaw(chatId: string | number, buf: Buffer, caption: string) {
  const token = tg().token;
  if (!token) return;
  try {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('caption', caption);
    fd.append('photo', new Blob([new Uint8Array(buf)]), 'qr.png');
    await fetch(`${API}/bot${token}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    console.error('[telegram] sendPhoto:', (e as Error).message);
  }
}

// ---------- Обработка команд ----------
async function handleUpdate(update: TgUpdate) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const cmd = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  const args = text.split(/\s+/).slice(1).join(' ').trim();

  if (cmd === '/start') {
    const code = args.split(/\s+/)[0];
    const t = tg();
    if (code && linkCode && code.toUpperCase() === linkCode) {
      const id = String(msg.from?.id ?? chatId);
      if (!t.bound.some((u) => String(u.id) === id)) {
        t.bound.push({ id, name: [msg.from?.first_name, msg.from?.username && '@' + msg.from.username].filter(Boolean).join(' ') });
        store.save();
      }
      linkCode = null;
      store.audit('telegram.bind', 'telegram', `привязан: ${msg.from?.username || id}`);
      await sendMessage(chatId, '✅ Панель привязана к этому чату. Теперь вам доступны команды.\n\n' + HELP);
      return;
    }
    if (await isBound(msg.from?.id ?? chatId)) return void (await sendMessage(chatId, HELP));
    await sendMessage(chatId, '🔒 Этот бот управляет VPN-панелью. Для привязки сгенерируйте код привязки в веб-панели (раздел Telegram) и отправьте /start КОД');
    return;
  }

  if (cmd === '/help' || cmd === '/help@*') {
    if (!(await guard(msg))) return;
    await sendMessage(chatId, HELP);
    return;
  }

  if (cmd === '/status') {
    if (!(await guard(msg))) return;
    const db = store.get();
    const online = db.clients.filter((c) => c.enabled && c.usage?.online).length;
    const enabled = db.clients.filter((c) => c.enabled).length;
    const r = awgctl.runtime;
    const t = snapshot();
    const lines = [
      '*Состояние сервера AmneziaWG*',
      `Интерфейс: ${r.ifaceUp ? '🟢 ' + db.settings.server.iface + ' активен' : '🔴 ' + db.settings.server.iface + ' остановлен'}`,
      `Endpoint: ${db.settings.server.endpoint || 'не задан'}:${db.settings.server.port}`,
      `Протокол: AWG ${db.settings.server.obf.version}`,
      '',
      `Клиенты: ${online} онлайн из ${enabled} вкл. (всего ${db.clients.length})`,
      `Трафик: ↓ ${bytes(t.net?.awgTotalRx || 0)} ↑ ${bytes(t.net?.awgTotalTx || 0)}`,
      `CPU: ${t.cpu ?? '—'}% | RAM: ${t.ramTotal ? Math.round((t.ramUsed / t.ramTotal) * 100) : '—'}%`
    ];
    await sendMessage(chatId, lines.join('\n'));
    return;
  }

  if (cmd === '/peers') {
    if (!(await guard(msg))) return;
    const db = store.get();
    if (!db.clients.length) return void (await sendMessage(chatId, 'Клиентов пока нет. Создайте: /add Имя'));
    const lines = db.clients.map((c) => {
      const st = c.enabled ? (c.usage?.online ? '🟢' : '⚪️') : '🔴';
      const lim = c.trafficLimitGb > 0 ? ` / ${c.trafficLimitGb} ГБ` : '';
      return `${st} ${c.name} — ${c.ip}${lim}\n    ↓ ${bytes(c.usage?.rx || 0)} ↑ ${bytes(c.usage?.tx || 0)}${c.expiresAt ? ' | до ' + c.expiresAt : ''}`;
    });
    await sendMessage(chatId, '*Клиенты:*\n\n' + lines.join('\n'));
    return;
  }

  if (cmd === '/add') {
    if (!(await guard(msg))) return;
    const name = args;
    if (!name) return void (await sendMessage(chatId, 'Укажите имя: /add iPhone-Алексей'));
    const created = await createPeer(name, 'telegram');
    if (created.error || !created.client) return void (await sendMessage(chatId, created.error || 'Ошибка'));
    await sendClientConfig(chatId, created.client);
    notify(true, `🆕 Клиент *${name}* создан через Telegram`);
    return;
  }

  if (cmd === '/key') {
    if (!(await guard(msg))) return;
    const c = findPeer(args);
    if (!c) return void (await sendMessage(chatId, 'Клиент не найден. Список: /peers'));
    await sendClientConfig(chatId, c);
    return;
  }

  if (cmd === '/on' || cmd === '/off') {
    if (!(await guard(msg))) return;
    const c = findPeer(args);
    if (!c) return void (await sendMessage(chatId, 'Клиент не найден.'));
    c.enabled = cmd === '/on';
    if (c.usage) c.usage.online = false;
    store.save();
    await awgctl.syncPeers();
    store.audit(cmd === '/on' ? 'client.enable' : 'client.disable', 'telegram', c.name);
    await sendMessage(chatId, cmd === '/on' ? `✅ ${c.name} включён` : `⛔️ ${c.name} отключён`);
    return;
  }

  if (cmd === '/del') {
    if (!(await guard(msg))) return;
    const db = store.get();
    const idx = db.clients.findIndex((c) => c.name.toLowerCase() === args.toLowerCase());
    if (idx < 0) return void (await sendMessage(chatId, 'Клиент не найден.'));
    const [c] = db.clients.splice(idx, 1);
    store.save();
    await awgctl.syncPeers();
    store.audit('client.delete', 'telegram', c.name);
    await sendMessage(chatId, `🗑 ${c.name} удалён`);
    return;
  }
}

// ---------- Цикл long polling ----------
async function pollLoop() {
  const st = state();
  st.running = true;
  const controller = new AbortController();
  st.controller = controller;
  console.log('[telegram] бот запущен (long polling)');
  while (st.running) {
    try {
      const token = tg().token;
      if (!token) break;
      const res = await fetch(`${API}/bot${token}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 25, offset: st.offset, drop_pending_updates: st.offset === 0 }),
        signal: controller.signal
      });
      const json = (await res.json()) as { ok: boolean; result?: TgUpdate[] };
      if (json.ok && Array.isArray(json.result)) {
        for (const u of json.result) {
          st.offset = u.update_id + 1;
          try { await handleUpdate(u); } catch (e) { console.error('[telegram] handle:', (e as Error).message); }
        }
      }
    } catch (e) {
      if (!st.running) break;
      // timeout ожидания — норма; прочие ошибки — пауза
      const msg = (e as Error).message || '';
      if (!msg.includes('timeout') && !msg.includes('abort')) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  st.running = false;
  console.log('[telegram] бот остановлен');
}

export function start(token?: string) {
  const t = token ?? tg().token;
  const st = state();
  stop();
  if (!t) return;
  // небольшая задержка, чтобы stop() успел прервать предыдущий цикл
  setTimeout(() => { if (tg().token) void pollLoop(); }, 300);
}

export function stop() {
  const st = state();
  st.running = false;
  try { st.controller?.abort(); } catch { /* noop */ }
  st.controller = undefined;
}

export function notify(flag: boolean, text: string) {
  if (!flag || !state().running) return;
  for (const u of tg().bound) {
    void sendMessage(u.id, text);
  }
}

export function notifyAll(text: string) { notify(true, text); }

export function status() {
  return { configured: !!tg().token, running: state().running, bound: tg().bound, hasCode: !!linkCode };
}

export function generateLinkCode(): string {
  linkCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  return linkCode;
}
