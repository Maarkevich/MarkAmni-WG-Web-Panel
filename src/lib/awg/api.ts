// ============================================
// api.ts — хелперы для API-роутов Next.js
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, can, type SessionUser } from './auth';
import type { Perm } from './types';

export function getUser(req: NextRequest): SessionUser | null {
  const cookie = req.headers.get('cookie') || '';
  const token = cookie.match(/awg_token=([^;]+)/)?.[1];
  if (!token) return null;
  return verifyToken(token);
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Возвращает пользователя либо Response с 401/403
export function guard(req: NextRequest, perm?: Perm): { user: SessionUser } | NextResponse {
  const user = getUser(req);
  if (!user) return err('Не авторизован', 401);
  if (perm && !can(user, perm)) return err('Недостаточно прав для этого действия', 403);
  return { user };
}

export function isGuardFail(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export function clientIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') || 'unknown';
}
