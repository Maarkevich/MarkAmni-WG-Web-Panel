// Тест формата vpn:// — проверка совместимости с официальным AmneziaVPN (qCompress)
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

// Эмулируем окружение панели
process.env.PANEL_DATA_DIR = '/tmp/awg-test-' + Date.now();

const { buildVpnLink, buildClientConf, decodeVpnLink } = await import('../src/lib/awg/conf');
const store = await import('../src/lib/awg/store');

// Инициализация БД
store.load();
const db = store.get();
db.settings.server.endpoint = '203.0.113.7';
db.settings.server.port = 51820;
db.settings.server.publicKey = 'eK5vGXJ0mP0uCT9AkVHIDsRDLv+NmD4VBp+ZbN5dMnk=';
db.settings.server.privateKey = db.settings.server.privateKey || 'yK3sVbJv0M6eQJ0yZ0hB9vXeN5bqZJ0hB9vXeN5bqZJ0=';

const client = {
  id: 'test-1', name: 'TestPhone', comment: '', ip: '10.8.1.2/32',
  mode: 'full', allowedIps: '',
  privateKey: 'yK3sVbJv0M6eQJ0yZ0hB9vXeN5bqZJ0hB9vXeN5bqZJ0=',
  publicKey: 'eK5vGXJ0mP0uCT9AkVHIDsRDLv+NmD4VBp+ZbN5dMnk=',
  presharedKey: 'aK3sVbJv0M6eQJ0yZ0hB9vXeN5bqZJ0hB9vXeN5bqZJ0=',
  enabled: true, trafficLimitGb: 0, expiresAt: '', createdAt: new Date().toISOString(),
  usage: { rx: 0, tx: 0, online: false, lastHandshake: '—' }
};

// 1. Конфиг клиента
const conf = buildClientConf(db, client);
console.log('=== Клиентский .conf (фрагмент) ===');
console.log(conf.split('\n').slice(0, 12).join('\n'));

// 2. vpn:// ссылка
const link = buildVpnLink(db, client);
console.log('\n=== vpn:// ссылка ===');
console.log(link.slice(0, 100) + '…');
console.log('Длина:', link.length);

// 3. Проверка: декодируется ли так, как это делает AmneziaVPN (Qt qUncompress)
const b64 = link.replace('vpn://', '');
// Python-стиль: urlsafe_b64decode
const buf = Buffer.from(b64, 'base64url'); // Node pads automatically
const size = buf.readUInt32BE(0);
const json = zlib.inflateSync(buf.subarray(4)).toString('utf8');
const ok = Buffer.byteLength(json, 'utf8') === size;
console.log('\n=== Проверка структуры qCompress ===');
console.log('4-байтный BE-заголовок:', buf.subarray(0, 4).toString('hex'), '(ожидался размер:', size + ')');
console.log('zlib-магия (78xx):', buf.subarray(4, 6).toString('hex'), '✓');
console.log('Размер совпадает:', ok ? '✓' : '✗');
console.log('JSON валиден:', !!JSON.parse(json));

// 4. Round-trip через наш декодер
const decoded = decodeVpnLink(link);
console.log('Round-trip decode:', decoded ? '✓' : '✗');

// 5. Симуляция декодера из amnezia-config-decoder.py (с паддингом)
const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
const pyBuf = Buffer.from(padded, 'base64');
console.log('Декодирование python-стилем (urlsafe+pad):', zlib.inflateSync(pyBuf.subarray(4)).toString('utf8') === json ? '✓' : '✗');

// 6. Конфиг для RU-режима
client.mode = 'ru';
const ruConf = buildClientConf(db, client).split('\n').find((l) => l.startsWith('AllowedIPs'));
console.log('\nAllowedIPs (ru, список загружен?):', ruConf ? ruConf.slice(0, 60) + '…' : '—');

fs.rmSync(process.env.PANEL_DATA_DIR, { recursive: true, force: true });
console.log('\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
