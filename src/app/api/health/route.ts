import { NextResponse } from 'next/server';
import { isDemo } from '@/lib/awg/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now(), demo: isDemo() });
}
