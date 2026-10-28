// ============================================
// routing.ts — маршрутизация: geoip:ru список, пресеты AllowedIPs
// geosite:ru (домены) для AWG реализуется через IP-подсети geoip:ru —
// в WireGuard-маршрутизации работают только IP-правила AllowedIPs.
// ============================================
import fs from 'fs';
import path from 'path';
import https from 'https';
import type { Client, RoutingMode } from './types';
import { DATA_DIR, audit } from './store';

const RU_V4 = path.join(DATA_DIR, 'ru-ipv4.txt');
const RU_V6 = path.join(DATA_DIR, 'ru-ipv6.txt');

const SOURCES_V4 = [
  'https://raw.githubusercontent.com/ipverse/ru/ip/aggregated/ru-aggregated.txt',
  'https://www.ipdeny.com/ipblocks/data/countries/ru.zone'
];
const SOURCES_V6 = [
  'https://raw.githubusercontent.com/ipverse/ru/ip6/aggregated/ru-aggregated-6.txt',
  'https://www.ipdeny.com/ipv6/ipaddresses/blocks/ru6.zone'
];

// Исключение домашних/локальных сетей (RFC1918, CGNAT, link-local, мультикаст...)
export const NOLOCAL = [
  '0.0.0.0/5', '8.0.0.0/7', '11.0.0.0/8', '12.0.0.0/6', '16.0.0.0/4', '32.0.0.0/3',
  '64.0.0.0/2', '128.0.0.0/3', '160.0.0.0/5', '168.0.0.0/6', '172.0.0.0/12',
  '172.32.0.0/11', '172.64.0.0/10', '172.128.0.0/9', '173.0.0.0/8', '174.0.0.0/7',
  '176.0.0.0/4', '192.0.0.0/9', '192.128.0.0/11', '192.160.0.0/13', '192.169.0.0/16',
  '192.170.0.0/15', '192.172.0.0/14', '192.176.0.0/12', '192.192.0.0/10', '193.0.0.0/8',
  '194.0.0.0/7', '196.0.0.0/6', '200.0.0.0/5', '208.0.0.0/4',
  // IPv6 без локальных диапазонов
  '2000::/3'
];

export const MODES: Record<RoutingMode, { title: string; desc: string }> = {
  full: { title: 'Полный туннель', desc: 'Весь трафик через VPN (0.0.0.0/0, ::/0)' },
  ru: { title: 'Только Россия (geoip:ru)', desc: 'Через VPN идут только IP-адреса РФ — банк, госуслуги и т.п.' },
  nolocal: { title: 'Без домашней сети', desc: 'Весь трафик через VPN, кроме локальной сети офиса/дома' },
  custom: { title: 'Свой список', desc: 'AllowedIPs задаются вручную для каждого клиента' }
};

function fetchText(url: string, redirects = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AmneziaWG-Panel/3.1' }, timeout: 25000 }, (res) => {
      if (res.statusCode! >= 300 && res.statusCode! < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchText(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function (this: https.ClientRequest) { this.destroy(new Error('timeout')); });
  });
}

function sanitizeList(text: string): string[] {
  return text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && (l.includes('/') || /^[0-9.]+$/.test(l)))
    .map((l) => (l.includes('/') ? l : (l.includes(':') ? l + '/128' : l + '/32')));
}

export async function updateRuList(): Promise<{ v4: number; v6?: number }> {
  const results: { v4: number; v6?: number } = { v4: 0 };
  for (const [key, sources, file] of [['v4', SOURCES_V4, RU_V4], ['v6', SOURCES_V6, RU_V6]] as const) {
    let ok = false, lastErr: Error | null = null;
    for (const url of sources) {
      try {
        const text = await fetchText(url);
        const lines = sanitizeList(text);
        if (lines.length < 50) throw new Error('список слишком мал: ' + lines.length);
        fs.writeFileSync(file, lines.join('\n'));
        if (key === 'v4') results.v4 = lines.length; else results.v6 = lines.length;
        ok = true;
        break;
      } catch (e) {
        lastErr = e as Error;
      }
    }
    if (!ok && key === 'v4') throw lastErr || new Error('Не удалось скачать список RU IPv4');
  }
  audit('routing.ru_update', 'system', `IPv4: ${results.v4}, IPv6: ${results.v6 || 0}`);
  return results;
}

export function ruInfo(): { exists: boolean; count: number; updatedAt: string | null } {
  const info = { exists: false, count: 0, updatedAt: null as string | null };
  try {
    if (fs.existsSync(RU_V4)) {
      const st = fs.statSync(RU_V4);
      const v4 = fs.readFileSync(RU_V4, 'utf8').split('\n').filter(Boolean).length;
      let v6 = 0;
      if (fs.existsSync(RU_V6)) v6 = fs.readFileSync(RU_V6, 'utf8').split('\n').filter(Boolean).length;
      info.exists = true;
      info.count = v4 + v6;
      info.updatedAt = st.mtime.toISOString();
    }
  } catch { /* noop */ }
  return info;
}

// Возвращает строку AllowedIPs для режима клиента
export function resolveAllowedIps(client: Client): string {
  const mode = client.mode || 'full';
  if (mode === 'full') return '0.0.0.0/0, ::/0';
  if (mode === 'nolocal') return NOLOCAL.join(', ');
  if (mode === 'ru') {
    const list: string[] = [];
    try {
      if (fs.existsSync(RU_V4)) list.push(...fs.readFileSync(RU_V4, 'utf8').split('\n').filter(Boolean));
      if (fs.existsSync(RU_V6)) list.push(...fs.readFileSync(RU_V6, 'utf8').split('\n').filter(Boolean));
    } catch { /* noop */ }
    if (!list.length) return '0.0.0.0/0, ::/0'; // список не загружен — полный туннель
    return list.join(', ');
  }
  return client.allowedIps || '0.0.0.0/0, ::/0';
}
