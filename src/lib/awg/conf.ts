// ============================================
// conf.ts — генерация серверных/клиентских конфигов и vpn:// ссылок
// ============================================
import zlib from 'zlib';
import type { Client, Db } from './types';
import * as obf from './obfuscation';
import { resolveAllowedIps } from './routing';

export function nextIp(db: Db): number | null {
  const used = new Set(
    db.clients.map((c) => {
      const m = String(c.ip).match(/\.(\d+)(?:\/\d+)?$/);
      return m ? parseInt(m[1], 10) : null;
    })
  );
  for (let i = 2; i <= 254; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

export function ipPrefix(subnet: string): string {
  const m = String(subnet).match(/^(\d+\.\d+\.\d+)\.\d+/);
  return m ? m[1] : '10.8.1';
}

// ---------- Серверный конфиг /etc/amnezia/amneziawg/awg0.conf ----------
export function buildServerConf(db: Db): string {
  const s = db.settings.server;
  const lines = [
    '# Сгенерировано AmneziaWG Panel (https://github.com/amnezia-vpn)',
    '[Interface]',
    `Address = ${s.serverIp}`,
    `ListenPort = ${s.port}`,
    `PrivateKey = ${s.privateKey}`,
    `MTU = ${obf.mtu(s.obf)}`,
    '',
    `# Параметры маскировки AmneziaWG ${s.obf.version} (DPI-resistant)`,
    obf.confLines(s.obf),
    '',
    '# NAT и firewall',
    `PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${s.wanIface} -j MASQUERADE`,
    `PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${s.wanIface} -j MASQUERADE`,
    ''
  ];
  for (const c of db.clients.filter((x) => x.enabled)) {
    lines.push(
      `# Клиент: ${c.name}${c.comment ? ' — ' + c.comment : ''}`,
      '[Peer]',
      `PublicKey = ${c.publicKey}`,
      `PresharedKey = ${c.presharedKey}`,
      `AllowedIPs = ${String(c.ip).includes('/') ? c.ip : c.ip + '/32'}`,
      ''
    );
  }
  return lines.join('\n');
}

// ---------- Клиентский .conf ----------
export function buildClientConf(db: Db, client: Client): string {
  const s = db.settings.server;
  const allowed = resolveAllowedIps(client);
  return [
    '[Interface]',
    `# Name: ${client.name}`,
    `Address = ${String(client.ip).includes('/') ? client.ip : client.ip + '/32'}`,
    `DNS = ${s.dns}`,
    `PrivateKey = ${client.privateKey}`,
    `MTU = ${obf.mtu(s.obf)}`,
    `# AmneziaWG ${s.obf.version}`,
    obf.confLines(s.obf),
    '',
    '[Peer]',
    `PublicKey = ${s.publicKey}`,
    `PresharedKey = ${client.presharedKey}`,
    `AllowedIPs = ${allowed}`,
    `Endpoint = ${s.endpoint}:${s.port}`,
    `PersistentKeepalive = ${s.keepalive}`,
    ''
  ].join('\n');
}

// ---------- Ссылка vpn:// для приложения AmneziaVPN ----------
// Официальный формат AmneziaVPN (Qt qCompress):
//   vpn:// + base64url( 4-байта BE-размера uncompressed + zlib(JSON) )
// base64url без паддинга (Base64UrlEncoding | OmitTrailingEquals),
// приложение декодирует через QByteArray::fromBase64(...) + qUncompress.
function encodeVpnPayload(json: string): string {
  const raw = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(raw.length, 0);
  return Buffer.concat([header, zlib.deflateSync(raw)]).toString('base64url');
}

export function buildVpnLink(db: Db, client: Client): string {
  const s = db.settings.server;
  const o = s.obf;
  const clientConf = buildClientConf(db, client);
  const dns1 = String(s.dns).split(',')[0].trim() || '1.1.1.1';
  const dns2 = String(s.dns).split(',')[1]?.trim() || '1.0.0.1';
  const lastConfig: Record<string, unknown> = {
    H1: String(o.H1), H2: String(o.H2), H3: String(o.H3), H4: String(o.H4),
    Jc: String(o.Jc), Jmin: String(o.Jmin), Jmax: String(o.Jmax),
    S1: String(o.S1), S2: String(o.S2),
    allowed_ips: resolveAllowedIps(client).split(',').map((x) => x.trim()).filter(Boolean),
    clientId: client.id,
    client_ip: String(client.ip).replace('/32', ''),
    client_priv_key: client.privateKey,
    client_pub_key: client.publicKey,
    config: clientConf,
    dns1,
    dns2,
    hostName: s.endpoint,
    mtu: String(obf.mtu(o)),
    persistent_keep_alive: String(s.keepalive),
    port: String(s.port),
    psk_key: client.presharedKey,
    server_pub_key: s.publicKey
  };
  if (o.version !== '1.5') {
    if (String(o.S3 ?? '').trim() !== '') lastConfig.S3 = String(o.S3);
    if (String(o.S4 ?? '').trim() !== '') lastConfig.S4 = String(o.S4);
    (['I1', 'I2', 'I3', 'I4', 'I5'] as const).forEach((k) => {
      if (String(o[k] ?? '').trim() !== '') lastConfig[k] = String(o[k]);
    });
  }
  if (o.version === '3.1') {
    if (String(o.HeaderProtectionKey ?? '').trim() !== '') lastConfig.HeaderProtectionKey = String(o.HeaderProtectionKey);
    if (String(o.ContentPaddingAddition ?? '').trim() !== '') lastConfig.ContentPaddingAddition = String(o.ContentPaddingAddition);
  }
  const awg: Record<string, string> = {
    H1: String(o.H1), H2: String(o.H2), H3: String(o.H3), H4: String(o.H4),
    Jc: String(o.Jc), Jmin: String(o.Jmin), Jmax: String(o.Jmax),
    S1: String(o.S1), S2: String(o.S2),
    last_config: JSON.stringify(lastConfig),
    port: String(s.port),
    transport_proto: 'udp'
  };
  if (o.version !== '1.5') {
    if (String(o.S3 ?? '') !== '') awg.S3 = String(o.S3);
    if (String(o.S4 ?? '') !== '') awg.S4 = String(o.S4);
    (['I1', 'I2', 'I3', 'I4', 'I5'] as const).forEach((k) => {
      if (String(o[k] ?? '') !== '') awg[k] = String(o[k]);
    });
  }
  if (o.version === '3.1') {
    if (String(o.HeaderProtectionKey ?? '') !== '') awg.HeaderProtectionKey = String(o.HeaderProtectionKey);
    if (String(o.ContentPaddingAddition ?? '') !== '') awg.ContentPaddingAddition = String(o.ContentPaddingAddition);
  }
  const payload = {
    containers: [{ awg, container: 'amnezia-awg' }],
    defaultContainer: 'amnezia-awg',
    description: `AWG ${o.version}: ${client.name}`,
    dns1,
    dns2,
    hostName: s.endpoint
  };
  return 'vpn://' + encodeVpnPayload(JSON.stringify(payload));
}

// Декодирование vpn:// (для самопроверки и отладки)
export function decodeVpnLink(link: string): unknown | null {
  try {
    const b64 = link.replace(/^vpn:\/\//, '');
    const buf = Buffer.from(b64, 'base64url');
    const size = buf.readUInt32BE(0);
    const json = zlib.inflateSync(buf.subarray(4)).toString('utf8');
    if (Buffer.byteLength(json, 'utf8') !== size) console.warn('[conf] vpn:// размер не совпадает');
    return JSON.parse(json);
  } catch {
    return null;
  }
}
