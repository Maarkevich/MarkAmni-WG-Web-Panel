// ============================================
// telemetry.ts — телеметрия сервера: CPU, RAM, диск, сеть, история
// ============================================
import os from 'os';
import fs from 'fs';
import type { TelemetrySnapshot } from './types';
import { get, addTraffic } from './store';

const SERIES_MAX = 180; // точек истории (при шаге 2с — 6 минут)
// Состояние — в globalThis: Turbopack дублирует модули между роутами,
// без этого у /api/dashboard своя пустая серия и график никогда не заполняется.
const g = globalThis as unknown as {
  __awgTelemetry?: {
    series: { t: number; cpu: number; rx: number; tx: number }[];
    lastCpu: { idle: number; total: number } | null;
    lastNet: { totalRx: number; totalTx: number; awgRx: number; awgTx: number } | null;
    cache: TelemetrySnapshot | null;
  };
};
function getG() {
  if (!g.__awgTelemetry) {
    g.__awgTelemetry = { series: [], lastCpu: null, lastNet: null, cache: null };
  }
  return g.__awgTelemetry;
}

function cpuTimes() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const c of cpus) {
    idle += c.times.idle;
    total += c.times.idle + c.times.user + c.times.nice + c.times.sys + c.times.irq;
  }
  return { idle, total };
}

function netCounters() {
  try {
    const text = fs.readFileSync('/proc/net/dev', 'utf8');
    let totalRx = 0, totalTx = 0, awgRx = 0, awgTx = 0;
    const iface = get().settings.server.iface || 'awg0';
    for (const line of text.split('\n').slice(2)) {
      const [nameRaw, data] = line.split(':');
      if (!data) continue;
      const name = nameRaw.trim();
      const cols = data.trim().split(/\s+/).map(Number);
      if (name === iface) { awgRx = cols[0] || 0; awgTx = cols[8] || 0; }
      if (name === 'lo') continue;
      totalRx += cols[0] || 0;
      totalTx += cols[8] || 0;
    }
    return { totalRx, totalTx, awgRx, awgTx };
  } catch {
    return { totalRx: 0, totalTx: 0, awgRx: 0, awgTx: 0 };
  }
}

function diskUsage() {
  try {
    const st = fs.statfsSync('/');
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bavail) * Number(st.bsize);
    return { total, used: total - free };
  } catch {
    return { total: 0, used: 0 };
  }
}

export function sample(): TelemetrySnapshot {
  const series = getG().series;
  const cpuNow = cpuTimes();
  let cpuPct = 0;
  if (getG().lastCpu) {
    const dTotal = cpuNow.total - getG().lastCpu!.total;
    const dIdle = cpuNow.idle - getG().lastCpu!.idle;
    cpuPct = dTotal > 0 ? Math.min(100, Math.round((1 - dIdle / dTotal) * 100)) : 0;
  }
  getG().lastCpu = cpuNow;

  const netNow = netCounters();
  let rxSec = 0, txSec = 0, awgRxSec = 0, awgTxSec = 0;
  if (getG().lastNet) {
    rxSec = Math.max(0, netNow.totalRx - getG().lastNet.totalRx) / 2;
    txSec = Math.max(0, netNow.totalTx - getG().lastNet.totalTx) / 2;
    awgRxSec = Math.max(0, netNow.awgRx - getG().lastNet.awgRx) / 2;
    awgTxSec = Math.max(0, netNow.awgTx - getG().lastNet.awgTx) / 2;
  }
  getG().lastNet = netNow;

  // Суточный счётчик трафика через туннель (шаг сэмпла — 2 с)
  if (awgRxSec > 0 || awgTxSec > 0) addTraffic(Math.round(awgRxSec * 2), Math.round(awgTxSec * 2));

  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const disk = diskUsage();

  const point = {
    t: Date.now(),
    cpu: cpuPct,
    rx: Math.round(rxSec),
    tx: Math.round(txSec)
  };
  series.push(point);
  if (series.length > SERIES_MAX) series.shift();

  const cache: TelemetrySnapshot = {
    cpu: cpuPct,
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model?.split('@')[0]?.trim() || '',
    load: os.loadavg().map((v) => +v.toFixed(2)),
    ramUsed: memTotal - memFree,
    ramTotal: memTotal,
    diskUsed: disk.used,
    diskTotal: disk.total,
    uptime: os.uptime(),
    platform: `${os.type()} ${os.release()}`,
    net: {
      rxSec: Math.round(rxSec), txSec: Math.round(txSec),
      awgRxSec: Math.round(awgRxSec), awgTxSec: Math.round(awgTxSec),
      totalRx: netNow.totalRx, totalTx: netNow.totalTx,
      awgTotalRx: netNow.awgRx, awgTotalTx: netNow.awgTx
    },
    t: point.t
  };
  getG().cache = cache;
  return cache;
}

export function start(intervalMs = 2000) {
  sample();
  const g = globalThis as unknown as { __awgTelemetryTimer?: ReturnType<typeof setInterval> };
  if (g.__awgTelemetryTimer) clearInterval(g.__awgTelemetryTimer);
  g.__awgTelemetryTimer = setInterval(sample, intervalMs);
}

export function snapshot(): TelemetrySnapshot {
  const st = getG();
  return { ...(st.cache || sample()), series: st.series.slice(-120) };
}
