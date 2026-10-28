import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json, err } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import * as conf from '@/lib/awg/conf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await bootstrap();
  const g = guard(req, 'clients');
  if (isGuardFail(g)) return g;
  const { id } = await params;
  const db = store.get();
  const c = db.clients.find((x) => x.id === id);
  if (!c) return err('Клиент не найден', 404);
  const text = conf.buildClientConf(db, c);
  const vpn = conf.buildVpnLink(db, c);
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(text, { margin: 1, width: 520, color: { dark: '#020617', light: '#ffffff' } });
  } catch {
    // Конфиг слишком велик для QR (например, режим geoip:ru с тысячами подсетей)
    qr = null;
  }
  return json({ conf: text, vpn, qr, qrTooBig: !qr, filename: `${c.name}.conf`, version: db.settings.server.obf.version });
}
