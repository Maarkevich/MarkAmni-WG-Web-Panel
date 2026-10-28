import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as conf from '@/lib/awg/conf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'server');
  if (isGuardFail(g)) return g;
  return json({ conf: conf.buildServerConf(store.get()) });
}
