// ============================================
// types.ts — общие типы панели AmneziaWG
// ============================================

export type AwgVersion = '1.5' | '2.0' | '3.1';

export interface ObfParams {
  version: AwgVersion;
  Jc: number;
  Jmin: number;
  Jmax: number;
  S1: number;
  S2: number;
  S3: number | string;
  S4: number | string;
  H1: string;
  H2: string;
  H3: string;
  H4: string;
  I1: string;
  I2: string;
  I3: string;
  I4: string;
  I5: string;
  HeaderProtectionKey: string;
  ContentPaddingAddition: string;
  RekeyAfterTime: string;
  RekeyTimeout: string;
  RejectAfterTime: string;
  KeepaliveTimeout: string;
  MaxHandshakeAttempts: string;
  extra: string;
  MTU?: number;
}

export interface ServerSettings {
  iface: string;
  wanIface: string;
  endpoint: string;
  port: number;
  subnet: string;
  serverIp: string;
  dns: string;
  mtu: number;
  keepalive: number;
  privateKey: string;
  publicKey: string;
  obf: ObfParams;
  defaultRouting: RoutingMode;
  autoDisableLimit: boolean;
  autoDisableExpired: boolean;
}

export type RoutingMode = 'full' | 'ru' | 'nolocal' | 'custom';

export interface TelegramSettings {
  token: string;
  bound: { id: string; name: string }[];
  notify: { created: boolean; expired: boolean; limit: boolean; disabled: boolean };
}

export interface DomainSettings {
  name: string;
  email: string;
  sslEnabled: boolean;
  nginxEnabled: boolean;
  lastSetup?: string;
  lastError?: string;
}

export interface Settings {
  panelName: string;
  server: ServerSettings;
  telegram: TelegramSettings;
  domain?: DomainSettings;
}

export interface ClientUsage {
  rx: number;
  tx: number;
  online: boolean;
  lastHandshake: string;
}

export interface Client {
  id: string;
  name: string;
  comment: string;
  ip: string;
  mode: RoutingMode;
  allowedIps: string;
  privateKey: string;
  publicKey: string;
  presharedKey: string;
  enabled: boolean;
  trafficLimitGb: number;
  expiresAt: string;
  createdAt: string;
  usage: ClientUsage;
}

export type Role = 'root' | 'admin';
export type Perm = 'dashboard' | 'clients' | 'server' | 'routing' | 'telegram' | 'admins' | 'logs' | 'domain';

export interface Admin {
  id: string;
  username: string;
  passHash: string;
  role: Role;
  perms: Perm[];
  createdAt: string;
}

export interface AuditEvent {
  ts: string;
  actor: string;
  action: string;
  details: string;
}

export interface Db {
  settings: Settings;
  admins: Admin[];
  clients: Client[];
  audit: AuditEvent[];
  traffic: Record<string, { rx: number; tx: number }>;
  meta: { createdAt: string; demoSeed: boolean };
}

export interface TelemetrySnapshot {
  cpu: number;
  cpuCores: number;
  cpuModel: string;
  load: number[];
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
  uptime: number;
  platform: string;
  net: {
    rxSec: number;
    txSec: number;
    awgRxSec: number;
    awgTxSec: number;
    totalRx: number;
    totalTx: number;
    awgTotalRx: number;
    awgTotalTx: number;
  };
  t: number;
  series?: { t: number; cpu: number; rx: number; tx: number }[];
}
