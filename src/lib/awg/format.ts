// ============================================
// format.ts — утилиты форматирования (бэкенд)
// ============================================

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
