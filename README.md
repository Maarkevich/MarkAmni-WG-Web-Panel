# MarkAmni WG Web Panel

**Modern Web Management Panel for AmneziaWG 3.1 / WireGuard**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.4-f9f1e1.svg)](https://bun.sh/)

Современная самохостируемая веб-панель для управления VPN-серверами AmneziaWG 3.1 и WireGuard. Построена на Next.js 16, Tailwind CSS 4, TypeScript.

---

## 🇷🇺 На русском

### Возможности

- 🚀 **Полная поддержка AmneziaWG 3.1** — все параметры обфускации: `Jc`, `Jmin`, `Jmax`, `S1-S4`, `H1-H4`, `I1-I5`, `HeaderProtectionKey`, `ContentPaddingAddition`, `RekeyAfterTime` и др.
- 👥 **Управление клиентами** — создание, удаление, включение/отключение пиров, лимиты трафика и дата истечения
- 📱 **QR-коды и конфиги** — мгновенная генерация `.conf`-файлов и QR-кодов для импорта в AmneziaVPN
- 🔒 **Безопасность** — авторизация через JWT-токены, ролевая модель (root / admin)
- 🎨 **Современный UI** — тёмная тема, адаптивный дизайн, Tailwind CSS 4 + shadcn/ui
- 📊 **Дашборд и телеметрия** — CPU, RAM, диск, аптайм, график трафика в реальном времени
- 🛣️ **Маршрутизация** — полный туннель, только Россия, без локальной сети, свой список
- 🤖 **Telegram-бот** — уведомления и управление через Telegram
- 📋 **Журнал аудита** — история всех действий в панели
- 🛠 **Простая установка** — один скрипт для развёртывания

### Быстрый старт — одна команда

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Maarkevich/MarkAmni-WG-Web-Panel/main/install.sh)
```

Скрипт автоматически:
1. Установит системные зависимости (`curl`, `git`, `iptables` и др.)
2. Установит **AmneziaWG 3.1** из официального PPA
3. Установит **Node.js 20** и **Bun**
4. Клонирует репозиторий и соберёт панель
5. Создаст и поднимет интерфейс `awg0` с параметрами обфускации AWG 3.1
6. Настроит **systemd**-сервис с автозапуском
7. Выведет в терминал ссылку, логин и пароль

**Пример вывода после установки:**
```
┌─────────────────────────────────────────────────┐
│        MarkAmni WG Web Panel установлена!       │
└─────────────────────────────────────────────────┘

  🌐 Адрес панели:  http://YOUR_IP:3080

  🔑 Учётные данные:
     Логин:  admin
     Пароль: xXxXxXxXxXxX

  ⚠️  Важно: Сохраните логин и пароль!
     После первого входа смените пароль:
     Администраторы → Профиль → Сменить пароль
```

**Требования:** Ubuntu 22.04 / 24.04, amd64, root-доступ

---

## 🇬🇧 In English

### Features

- 🚀 **Full AmneziaWG 3.1 support** — all obfuscation params: `Jc`, `Jmin`, `Jmax`, `S1-S4`, `H1-H4`, `I1-I5`, `HeaderProtectionKey`, `ContentPaddingAddition`, `RekeyAfterTime`, etc.
- 👥 **Client management** — create, delete, enable/disable peers, traffic limits and expiry dates
- 📱 **QR codes & configs** — instant `.conf` file and QR code generation for AmneziaVPN import
- 🔒 **Security** — JWT-based authentication, role model (root / admin)
- 🎨 **Modern UI** — dark theme, responsive design, Tailwind CSS 4 + shadcn/ui
- 📊 **Dashboard & telemetry** — CPU, RAM, disk, uptime, real-time traffic chart
- 🛣️ **Routing** — full tunnel, Russia-only, no-local, custom IP list
- 🤖 **Telegram bot** — notifications and management via Telegram
- 📋 **Audit log** — full history of panel actions
- 🛠 **Easy setup** — single script deployment

### Quick Start — one command

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Maarkevich/MarkAmni-WG-Web-Panel/main/install.sh)
```

The script automatically:
1. Installs system dependencies (`curl`, `git`, `iptables`, etc.)
2. Installs **AmneziaWG 3.1** from the official PPA
3. Installs **Node.js 20** and **Bun**
4. Clones the repository and builds the panel
5. Creates and brings up the `awg0` interface with AWG 3.1 obfuscation parameters
6. Sets up a **systemd** service with autostart
7. Prints the panel URL, login and password to the terminal

**Requirements:** Ubuntu 22.04 / 24.04, amd64, root access

---

## 🔒 HTTPS — бесплатный домен + SSL-сертификат

Для работы HTTPS нужен домен. Если его нет — получи бесплатный поддомен за 2 минуты.

### Шаг 1 — Бесплатный домен (freedns.afraid.org)

1. Зайди на **[freedns.afraid.org](https://freedns.afraid.org)**
2. Зарегистрируйся (бесплатно)
3. Перейди в **Subdomains → Add**
4. Выбери любой тип: `A`, любой домен из списка (например `twilightparadox.com`)
5. Придумай имя поддомена (например `mypanel`)
6. В поле **Destination** укажи IP своего сервера
7. Нажми **Save** — поддомен готов (`mypanel.twilightparadox.com`)

### Шаг 2 — Nginx + SSL одной командой

```bash
DOMAIN=твой.домен.com SSL_EMAIL=твой@email.com bash <(curl -fsSL https://raw.githubusercontent.com/Maarkevich/MarkAmni-WG-Web-Panel/main/install.sh)
```

Или если панель уже установлена — отдельный скрипт настройки Nginx+SSL:

```bash
apt-get install -y nginx certbot python3-certbot-nginx

# Создать конфиг и получить сертификат
cat > /etc/nginx/sites-available/markamni-panel << 'EOF'
server {
    listen 80;
    server_name ВАШ_ДОМЕН;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
EOF

ln -sf /etc/nginx/sites-available/markamni-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

certbot --nginx -d ВАШ_ДОМЕН --non-interactive --agree-tos --email ВАШ@EMAIL.COM --redirect

# Добавить proxy_pass в конфиг (заменить location /)
# Затем: nginx -t && systemctl reload nginx
```

После настройки панель будет доступна по **`https://ВАШ_ДОМЕН`** с автоматически обновляемым сертификатом.

> **Сертификат обновляется автоматически** через systemd-таймер certbot. Действует 90 дней, обновляется каждые ~60 дней.

---

## 📸 Screenshots

### Dashboard
![Dashboard](screenshots/dashboard.jpg)

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Auth | JWT tokens (custom) |
| Runtime | Bun 1.4 / Node.js 20 |
| VPN | AmneziaWG 3.1 / WireGuard |
| Storage | JSON file-based (no external DB required) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/me` | Current user |
| GET | `/api/state` | Server state |
| GET | `/api/dashboard` | Dashboard telemetry |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| DELETE | `/api/clients/:id` | Delete client |
| GET | `/api/clients/:id/export` | Export client config + QR |
| POST | `/api/server/apply` | Apply server config |
| GET | `/api/logs` | Audit log |

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ by [Maarkevich](https://github.com/Maarkevich)**
