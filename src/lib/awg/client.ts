'use client';

// ============================================
// client.tsx — клиентские утилиты: API-запросы, форматтеры
// ============================================

export async function api<T = unknown>(path: string, opts?: RequestInit & { json?: unknown }): Promise<T> {
  const init: RequestInit = { ...opts };
  init.headers = { ...(opts?.headers || {}) };
  if (opts?.json !== undefined) {
    init.method = opts.method || 'POST';
    init.body = JSON.stringify(opts.json);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, init);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 300) || `HTTP ${res.status}`);
    return text as unknown as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export function bytes(b: number): string {
  if (!b || b <= 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(b) / Math.log(k)));
  const v = b / Math.pow(k, i);
  return (v >= 100 ? v.toFixed(0) : v.toFixed(2)) + ' ' + sizes[i];
}

export function speed(bps: number): string {
  const v = bytes(bps);
  return v === '0 Б' ? '0 Бит/с' : v.replace(/Б$/, 'Б/с');
}

export function uptime(sec: number): string {
  sec = Math.floor(sec || 0);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} дн. ${h} ч.`;
  if (h > 0) return `${h} ч. ${m} мин.`;
  return `${m} мин.`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; }
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
}

// ---------- Типы API ----------
export interface SessionUser {
  id: string;
  username: string;
  role: 'root' | 'admin';
  perms: string[];
}

export interface Obf {
  version: '1.5' | '2.0' | '3.1';
  Jc: number; Jmin: number; Jmax: number; S1: number; S2: number;
  S3: number | string; S4: number | string;
  H1: string; H2: string; H3: string; H4: string;
  I1: string; I2: string; I3: string; I4: string; I5: string;
  HeaderProtectionKey: string; ContentPaddingAddition: string;
  RekeyAfterTime: string; RekeyTimeout: string; RejectAfterTime: string;
  KeepaliveTimeout: string; MaxHandshakeAttempts: string;
  extra: string; MTU?: number;
}

export interface PanelState {
  panelName: string;
  server: {
    iface: string; wanIface: string; endpoint: string; port: number;
    subnet: string; serverIp: string; dns: string; mtu: number; keepalive: number;
    privateKey: string; publicKey: string; obf: Obf;
    defaultRouting: string; autoDisableLimit: boolean; autoDisableExpired: boolean;
  };
  runtime: {
    demo: boolean; awgInstalled: boolean; ifaceUp: boolean;
    toolVersion: string; moduleVersion: string; detectedIp: string; lastApplyMessage: string;
    interface: string;
  };
  role: string;
  perms: string[];
  demo: boolean;
}

export interface ClientRow {
  id: string; name: string; comment: string; ip: string;
  mode: 'full' | 'ru' | 'nolocal' | 'custom';
  allowedIps: string; privateKey: string; publicKey: string; presharedKey: string;
  enabled: boolean; trafficLimitGb: number; expiresAt: string; createdAt: string;
  usage: { rx: number; tx: number; online: boolean; lastHandshake: string };
}

export interface Dashboard {
  telemetry: {
    cpu: number; cpuCores: number; cpuModel: string; load: number[];
    ramUsed: number; ramTotal: number; diskUsed: number; diskTotal: number;
    uptime: number; platform: string;
    net: { rxSec: number; txSec: number; awgRxSec: number; awgTxSec: number; totalRx: number; totalTx: number; awgTotalRx: number; awgTotalTx: number };
    t: number;
    series?: { t: number; cpu: number; rx: number; tx: number }[];
  };
  stats: { totalPeers: number; enabled: number; online: number; totalRx: number; totalTx: number; awgTotalRx: number; awgTotalTx: number };
  topClients: { id: string; name: string; rx: number; tx: number; online: boolean }[];
  events: { ts: string; actor: string; action: string; details: string }[];
  trafficToday: { rx: number; tx: number };
}

export const PERM_TITLES: Record<string, string> = {
  dashboard: 'Дашборд и телеметрия',
  clients: 'Управление клиентами',
  server: 'Настройки сервера и обфускации',
  routing: 'Маршрутизация',
  telegram: 'Telegram-бот',
  admins: 'Управление администраторами',
  logs: 'Журнал аудита'
};

export const ROUTING_TITLES: Record<string, string> = {
  full: 'Полный туннель',
  ru: 'Только Россия (geoip:ru)',
  nolocal: 'Без домашней сети',
  custom: 'Свой список'
};
