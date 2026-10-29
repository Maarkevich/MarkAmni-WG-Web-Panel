import { NextRequest } from 'next/server';
import { bootstrap } from '@/lib/awg/bootstrap';
import { guard, isGuardFail, json } from '@/lib/awg/api';
import * as store from '@/lib/awg/store';
import { execSync } from 'child_process';
import fs from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — вернуть текущие настройки домена
export async function GET(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'server');
  if (isGuardFail(g)) return g;
  const db = store.get();
  return json({ domain: db.settings.domain || {} });
}

// POST — установить домен и настроить Nginx+SSL
export async function POST(req: NextRequest) {
  await bootstrap();
  const g = guard(req, 'server');
  if (isGuardFail(g)) return g;

  const body = await req.json() as { name?: string; email?: string; action?: string; useDomainAsEndpoint?: boolean; useFakeSni?: boolean };
  const db = store.get();

  if (!db.settings.domain) {
    db.settings.domain = { name: '', email: '', sslEnabled: false, nginxEnabled: false };
  }

  // action=update-options — обновить только опции маскировки (без переустановки SSL)
  if (body.action === 'update-options') {
    if (typeof body.useDomainAsEndpoint === 'boolean') {
      db.settings.domain.useDomainAsEndpoint = body.useDomainAsEndpoint;
    }
    if (typeof body.useFakeSni === 'boolean') {
      db.settings.domain.useFakeSni = body.useFakeSni;
    }
    store.save();
    store.audit('domain.options', 'admin', `endpoint=${db.settings.domain.useDomainAsEndpoint} sni=${db.settings.domain.useFakeSni}`);
    return json({ ok: true, domain: db.settings.domain });
  }

  // action=remove — удалить домен и Nginx конфиг
  if (body.action === 'remove') {
    try {
      execSync('systemctl stop nginx 2>/dev/null || true', { timeout: 10000 });
      execSync('rm -f /etc/nginx/sites-enabled/markamni-panel /etc/nginx/sites-available/markamni-panel', { timeout: 5000 });
      execSync('systemctl start nginx 2>/dev/null || true', { timeout: 10000 });
    } catch { /* ignore */ }
    db.settings.domain = { name: '', email: '', sslEnabled: false, nginxEnabled: false };
    store.save();
    store.audit('domain.remove', 'admin');
    return json({ ok: true, message: 'Домен и Nginx конфиг удалены' });
  }

  const domainName = (body.name || '').trim().toLowerCase().replace(/^https?:\/\//, '');
  const email = (body.email || '').trim();

  if (!domainName) return json({ ok: false, error: 'Укажите домен' }, 400);
  if (!email || !email.includes('@')) return json({ ok: false, error: 'Укажите корректный email для SSL-сертификата' }, 400);

  // Проверить что домен резолвится
  let resolvedIp = '';
  try {
    resolvedIp = execSync(
      `curl -sf --connect-timeout 5 "https://dns.google/resolve?name=${domainName}&type=A" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Answer'][0]['data'])"`,
      { timeout: 15000 }
    ).toString().trim();
  } catch {
    return json({ ok: false, error: `Домен ${domainName} не резолвится. Убедитесь что DNS-запись настроена.` }, 400);
  }

  // Определить внешний IP сервера
  let serverIp = '';
  try {
    serverIp = execSync('curl -sf --connect-timeout 5 https://api.ipify.org', { timeout: 10000 }).toString().trim();
  } catch {
    serverIp = execSync("hostname -I | awk '{print $1}'", { timeout: 5000 }).toString().trim();
  }

  if (resolvedIp !== serverIp) {
    return json({ ok: false, error: `Домен ${domainName} указывает на ${resolvedIp}, а не на ${serverIp}. Исправьте DNS-запись.` }, 400);
  }

  const panelPort = process.env.PORT || '3080';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const wanIface = db.settings.server.wanIface || 'eth0';

  try {
    // 1. Установить Nginx если нет
    if (!fs.existsSync('/usr/sbin/nginx')) {
      execSync('apt-get install -y -qq nginx', { timeout: 120000 });
    }

    // 2. Создать базовый конфиг для ACME challenge
    const nginxBasic = `server {
    listen 80;
    server_name ${domainName};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}\n`;
    fs.mkdirSync('/etc/nginx/sites-available', { recursive: true });
    fs.mkdirSync('/etc/nginx/sites-enabled', { recursive: true });
    fs.writeFileSync('/etc/nginx/sites-available/markamni-panel', nginxBasic);

    try { execSync('rm -f /etc/nginx/sites-enabled/default', { timeout: 5000 }); } catch { /* ignore */ }
    try { execSync('ln -sf /etc/nginx/sites-available/markamni-panel /etc/nginx/sites-enabled/markamni-panel', { timeout: 5000 }); } catch { /* ignore */ }

    execSync('systemctl enable nginx -q && systemctl restart nginx', { timeout: 30000 });

    // 3. Установить Certbot если нет
    if (!fs.existsSync('/usr/bin/certbot')) {
      execSync('apt-get install -y -qq certbot python3-certbot-nginx', { timeout: 120000 });
    }

    // 4. Получить сертификат (пропускаем если уже есть)
    const certPath = `/etc/letsencrypt/live/${domainName}/fullchain.pem`;
    if (!fs.existsSync(certPath)) {
      execSync(`certbot --nginx -d ${domainName} --non-interactive --agree-tos --email ${email} --redirect 2>&1`, { timeout: 120000 });
    } else {
      // Сертификат уже есть — только обновим конфиг nginx если нужно
      execSync('systemctl reload nginx 2>/dev/null || true', { timeout: 10000 });
    } (feat: domain masking, vpn:// link fix (amnezia-awg2 + protocol_version), auto-detect wanIface, skip certbot if cert exists)

    // 5. Записать финальный конфиг с proxy_pass
    const nginxFull = `# Managed by MarkAmni WG Web Panel
server {
    listen 80;
    server_name ${domainName};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    server_name ${domainName};
    ssl_certificate     /etc/letsencrypt/live/${domainName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domainName}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    client_max_body_size 64m;
    location / {
        proxy_pass         http://127.0.0.1:${panelPort};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_cache_bypass $http_upgrade;
    }
}\n`;
    fs.writeFileSync('/etc/nginx/sites-available/markamni-panel', nginxFull);
    execSync('nginx -t && systemctl reload nginx', { timeout: 30000 });

    // 6. Сохранить в store
    db.settings.domain = {
      name: domainName,
      email,
      sslEnabled: true,
      nginxEnabled: true,
      lastSetup: new Date().toISOString(),
      lastError: ''
    };
    store.save();
    store.audit('domain.setup', 'admin', domainName);

    return json({ ok: true, message: `Домен ${domainName} настроен. Панель доступна по https://${domainName}`, url: `https://${domainName}` });

  } catch (e) {
    const errMsg = (e as Error).message?.slice(0, 500) || 'Неизвестная ошибка';
    db.settings.domain = { ...db.settings.domain!, name: domainName, email, sslEnabled: false, nginxEnabled: false, lastError: errMsg };
    store.save();
    return json({ ok: false, error: `Ошибка настройки: ${errMsg}` }, 500);
  }
}
