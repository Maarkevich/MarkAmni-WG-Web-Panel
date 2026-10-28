// ============================================
// auth.ts — HMAC-JWT сессии, администраторы и права доступа
// JWT реализован на node:crypto (HMAC-SHA256) — без внешних зависимостей
// ============================================
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Perm, Role } from './types';
import { get, persistNow, jwtSecret, audit, DATA_DIR } from './store';

export const PERMS: Perm[] = ['dashboard', 'clients', 'server', 'routing', 'telegram', 'admins', 'logs'];
export const PERM_TITLES: Record<Perm, string> = {
  dashboard: 'Дашборд и телеметрия',
  clients: 'Управление клиентами',
  server: 'Настройки сервера и обфускации',
  routing: 'Маршрутизация',
  telegram: 'Telegram-бот',
  admins: 'Управление администраторами',
  logs: 'Журнал аудита'
};

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  perms: Perm[];
  exp: number;
}

const attempts = new Map<string, { count: number; ts: number }>(); // ip -> { count, ts }

export function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.ts > 60000) {
    attempts.set(ip, { count: 1, ts: now });
    return false;
  }
  rec.count++;
  return rec.count > 8;
}

export function clearAttempts(ip: string) {
  attempts.delete(ip);
}

// ---------- Минимальный JWT (HS256) ----------
function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function signToken(admin: { id: string; username: string; role: Role; perms: Perm[] }): string {
  const payload = {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    perms: admin.role === 'root' ? PERMS : admin.perms,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600
  };
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const sig = crypto.createHmac('sha256', jwtSecret()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const [head, body, sig] = token.split('.');
    if (!head || !body || !sig) return null;
    const expect = crypto.createHmac('sha256', jwtSecret()).update(`${head}.${body}`).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionUser;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Bootstrap главного администратора ----------
export function bootstrapRoot(): { username: string; password: string } | null {
  const db = get();
  if (db.admins.some((a) => a.role === 'root')) return null;
  const username = (process.env.ADMIN_USER || 'admin').trim() || 'admin';
  const password = (process.env.ADMIN_PASS || crypto.randomBytes(9).toString('base64url')).trim();
  const admin = {
    id: crypto.randomUUID(),
    username,
    passHash: bcrypt.hashSync(password, 10),
    role: 'root' as Role,
    perms: [...PERMS],
    createdAt: new Date().toISOString()
  };
  db.admins.push(admin);
  persistNow();
  const credFile = path.join(DATA_DIR, 'initial-credentials.txt');
  try {
    fs.writeFileSync(
      credFile,
      `Первый вход в панель AmneziaWG\nЛогин: ${username}\nПароль: ${password}\n(смените пароль в разделе «Администраторы» → «Профиль»)\n`,
      { mode: 0o600 }
    );
  } catch { /* noop */ }
  console.log('==========================================================');
  console.log('  Создан главный администратор панели:');
  console.log(`  Логин:  ${username}`);
  console.log(`  Пароль: ${password}`);
  console.log(`  (также записан в ${credFile})`);
  console.log('==========================================================');
  return { username, password };
}

export function verify(username: string, password: string) {
  const db = get();
  const admin = db.admins.find((a) => a.username.toLowerCase() === String(username).toLowerCase());
  if (!admin) return null;
  if (!bcrypt.compareSync(String(password), admin.passHash)) return null;
  return admin;
}

export function publicUser(u: { id: string; username: string; role: Role; perms?: Perm[] }) {
  return { id: u.id, username: u.username, role: u.role, perms: u.role === 'root' ? PERMS : u.perms || [] };
}

export function can(user: SessionUser | null, perm: Perm): boolean {
  return !!user && (user.role === 'root' || (user.perms || []).includes(perm));
}

export function auditEvent(action: string, actor: string, details = '') {
  audit(action, actor, details);
}
