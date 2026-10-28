// ============================================
// obfuscation.ts — параметры обфускации AWG 1.5 / 2.0 / 3.1
//
// Спецификация AmneziaWG:
//  Jc  1..128 (рек. 4..12)      — количество мусорных пакетов перед handshake
//  Jmin/Jmax — размер мусора, Jmax > Jmin < 1280 (рек. 8 / 80)
//  S1  ≤1132, S2 ≤1188 (рек. 15..150), правило S1 + 56 !== S2
//  S3/S4 — префиксы Cookie/Data (2.0+), при HeaderProtectionKey S1..S4 ≥ 12
//  H1..H4 — уникальные (1.x — числа; 2.0+/3.x — диапазоны без пересечений)
//  I1..I5 — CPS-сигнатуры маскировки (имитация QUIC/DNS), 2.0+
//  3.1: HeaderProtectionKey (32B base64), ContentPaddingAddition, таймеры
// ============================================
import crypto from 'crypto';
import type { AwgVersion, ObfParams } from './types';
import { defaultObf } from './store';

export const I1_QUIC_DEFAULT = '<b 0xc00000000108><r 16><t><r 24>';
export const I2_QUIC_DEFAULT = '<b 0x40><t><r 12>';

function ri(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Уникальное непересекающееся число/диапазон для H-заголовков
function genHeaders(asRanges: boolean): { H1: string; H2: string; H3: string; H4: string } {
  const taken: [number, number][] = [];
  const alloc = (): string => {
    for (let attempt = 0; attempt < 500; attempt++) {
      const start = ri(100000, 2100000000 - 300000);
      const end = asRanges ? start + ri(50000, 250000) : start;
      if (taken.some(([s, e]) => !(end + 1000 < s || start > e - 1000))) continue;
      taken.push([start, end]);
      return asRanges ? `${start}-${end}` : String(start);
    }
    return String(ri(1000000, 2000000000));
  };
  return { H1: alloc(), H2: alloc(), H3: alloc(), H4: alloc() };
}

function genBase() {
  const Jc = ri(4, 12);
  const Jmin = ri(8, 40);
  const Jmax = Math.min(1279, Jmin + ri(60, 160));
  const S1 = ri(15, 150);
  let S2: number;
  do { S2 = ri(15, 150); } while (S1 + 56 === S2 || S1 === S2);
  return { Jc, Jmin, Jmax, S1, S2 };
}

// Генерация полного набора параметров под версию протокола
export function generate(version: AwgVersion = '3.1'): ObfParams {
  const base = genBase();
  const obf = defaultObf(version);
  Object.assign(obf, base);

  if (version === '1.5') {
    Object.assign(obf, genHeaders(false));
    obf.MTU = 1420;
    return obf;
  }

  // 2.0 / 3.1: S3, S4, диапазоны H, сигнатуры I1-I5
  obf.S3 = ri(15, 150);
  do { obf.S4 = ri(15, 150); } while (obf.S3 === obf.S4);
  Object.assign(obf, genHeaders(true));
  obf.I1 = I1_QUIC_DEFAULT;
  obf.I2 = I2_QUIC_DEFAULT;
  obf.MTU = 1400;

  if (version === '3.1') {
    // HeaderProtectionKey: 32 байта base64; требует S1..S4 >= 12
    obf.HeaderProtectionKey = crypto.randomBytes(32).toString('base64');
    obf.S1 = Math.max(obf.S1, 15);
    obf.S2 = Math.max(obf.S2, 15);
    obf.S3 = Math.max(Number(obf.S3) || 15, 15);
    obf.S4 = Math.max(Number(obf.S4) || 15, 15);
    obf.ContentPaddingAddition = '8-64';
    obf.MTU = 1280;
  }
  return obf;
}

// Список полей, редактируемых в UI (по версиям)
export const FIELDS = {
  common: ['Jc', 'Jmin', 'Jmax', 'S1', 'S2'],
  v2: ['S3', 'S4', 'I1', 'I2', 'I3', 'I4', 'I5'],
  v31: ['HeaderProtectionKey', 'ContentPaddingAddition', 'RekeyAfterTime', 'RekeyTimeout', 'RejectAfterTime', 'KeepaliveTimeout', 'MaxHandshakeAttempts']
};

export function validate(obf: Partial<ObfParams> & { version?: string }): string[] {
  const errors: string[] = [];
  const num = (v: unknown) => parseInt(String(v), 10);
  const Jc = num(obf.Jc), Jmin = num(obf.Jmin), Jmax = num(obf.Jmax);
  if (!(Jc >= 1 && Jc <= 128)) errors.push('Jc должен быть в диапазоне 1..128');
  if (!(Jmin >= 1 && Jmin < 1280)) errors.push('Jmin должен быть 1..1279');
  if (!(Jmax > Jmin && Jmax <= 1280)) errors.push('Jmax должен быть > Jmin и ≤ 1280');

  const s = (k: string): number | null => {
    const v = String((obf as Record<string, unknown>)[k] ?? '').trim();
    if (v === '') return null;
    if (!/^\d+$/.test(v)) { errors.push(`${k} должен быть числом`); return null; }
    return num(v);
  };
  const S1 = s('S1'), S2 = s('S2'), S3 = s('S3'), S4 = s('S4');
  if (S1 !== null && (S1 < 0 || S1 > 1132)) errors.push('S1 должен быть 0..1132');
  if (S2 !== null && (S2 < 0 || S2 > 1188)) errors.push('S2 должен быть 0..1188');
  if (S1 !== null && S2 !== null && S1 + 56 === S2) errors.push('Правило AmneziaWG: S1 + 56 не должно равняться S2');

  // Проверка диапазонов/уникальности H1-H4
  const parseH = (v: unknown): [number, number] | null => {
    const str = String(v ?? '').trim();
    if (/^\d+$/.test(str)) return [num(str), num(str)];
    const m = str.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return [num(m[1]), num(m[2])];
    return null;
  };
  const hs = ['H1', 'H2', 'H3', 'H4'].map((k) => ({ k, r: parseH((obf as Record<string, unknown>)[k]) }));
  hs.forEach(({ k, r }) => {
    if (!r) { errors.push(`${k}: укажите число или диапазон вида 1000000-1200000`); return; }
    if (r[0] < 5 || r[1] > 2147483647 || r[0] > r[1]) errors.push(`${k}: диапазон должен быть в 5..2147483647`);
  });
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i].r, b = hs[j].r;
      if (!a || !b) continue;
      if (!(a[1] + 1 < b[0] || b[1] + 1 < a[0])) {
        errors.push(`${hs[i].k} и ${hs[j].k} пересекаются — диапазоны H должны быть непересекающимися`);
      }
    }
  }

  // 3.1: HeaderProtectionKey требует S1..S4 >= 12
  const hasHP = String(obf.HeaderProtectionKey || '').trim() !== '';
  if (hasHP) {
    if (obf.version !== '3.1') errors.push('HeaderProtectionKey доступен только в AmneziaWG 3.1');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(String(obf.HeaderProtectionKey).trim()) ||
        Buffer.from(String(obf.HeaderProtectionKey).trim(), 'base64').length !== 32) {
      errors.push('HeaderProtectionKey должен быть 32-байтным ключом в base64');
    }
    ([['S1', S1], ['S2', S2], ['S3', S3], ['S4', S4]] as [string, number | null][]).forEach(([k, v]) => {
      if (v !== null && v < 12) errors.push(`При HeaderProtectionKey ${k} должен быть ≥ 12`);
      if (v === null && (k === 'S3' || k === 'S4')) errors.push(`При HeaderProtectionKey ${k} обязателен (≥ 12)`);
    });
  }
  return errors;
}

// Строки конфига с параметрами обфускации для данной версии
export function confLines(obf: ObfParams): string {
  const v = obf.version || '1.5';
  const lines = [
    `Jc = ${obf.Jc}`,
    `Jmin = ${obf.Jmin}`,
    `Jmax = ${obf.Jmax}`,
    `S1 = ${obf.S1}`,
    `S2 = ${obf.S2}`
  ];
  if (v !== '1.5') {
    if (String(obf.S3 ?? '').trim() !== '') lines.push(`S3 = ${obf.S3}`);
    if (String(obf.S4 ?? '').trim() !== '') lines.push(`S4 = ${obf.S4}`);
  }
  lines.push(`H1 = ${obf.H1}`, `H2 = ${obf.H2}`, `H3 = ${obf.H3}`, `H4 = ${obf.H4}`);
  if (v !== '1.5') {
    (['I1', 'I2', 'I3', 'I4', 'I5'] as const).forEach((k) => {
      if (String(obf[k] ?? '').trim() !== '') lines.push(`${k} = ${obf[k]}`);
    });
  }
  if (v === '3.1') {
    (['HeaderProtectionKey', 'ContentPaddingAddition', 'RekeyAfterTime', 'RekeyTimeout', 'RejectAfterTime', 'KeepaliveTimeout', 'MaxHandshakeAttempts'] as const).forEach((k) => {
      if (String(obf[k] ?? '').trim() !== '') lines.push(`${k} = ${obf[k]}`);
    });
  }
  if (String(obf.extra ?? '').trim() !== '') lines.push(String(obf.extra).trim());
  return lines.join('\n');
}

export function mtu(obf: ObfParams): number {
  const v = Number(obf.MTU);
  return v > 0 ? v : (obf.version === '3.1' ? 1280 : 1420);
}
