# MarkAmni WG Web Panel

**Modern Web Management Panel for AmneziaWG 3.1 / WireGuard**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

A powerful, self-hosted web interface for managing AmneziaWG and WireGuard VPN servers. Built with Next.js 16, Tailwind CSS 4.

---

## 🇷🇺 На русском

**MarkAmni WG Web Panel** — это современная веб-панель для управления серверами AmneziaWG 3.1 и WireGuard.

### Возможности
- 🚀 **Полная поддержка AmneziaWG 3.1** — все параметры обфускации (Jc, Jmin, Jmax, S1-S4, H1-H4, I1-I5, HeaderProtectionKey и др.)
- 👥 **Управление клиентами** — создание, удаление, включение/отключение пиров
- 📱 **QR-коды и конфиги** — мгновенная генерация конфигов и QR-кодов для импорта в AmneziaVPN
- 🔒 **Безопасность** — авторизация через JWT-токены
- 🎨 **Современный UI** — тёмная тема, адаптивный дизайн, Tailwind CSS 4
- 📊 **Статистика** — мониторинг подключений, CPU, RAM, диска
- 🛠 **Простая установка** — один скрипт для развёртывания

### Быстрый старт

```bash
# Клонировать репозиторий
git clone https://github.com/Maarkevich/MarkAmni-WG-Web-Panel.git
cd MarkAmni-WG-Web-Panel

# Установить зависимости
bun install

# Настроить окружение
echo "NEXTAUTH_SECRET=your-secret-key" > .env
echo "NEXTAUTH_URL=http://localhost:3080" >> .env
echo "PORT=3080" >> .env

# Собрать и запустить
bun run build
bun run start
```

Панель будет доступна на `http://localhost:3080`.

При первом запуске панель автоматически создаст администратора:
- Логин: `admin`
- Пароль: генерируется автоматически (см. логи или файл `data/panel/initial-credentials.txt`)

### ⚠️ Известные проблемы

На момент версии 1.0.0 имеется баг с рендерингом дашборда: после авторизации интерфейс показывает спиннер загрузки, хотя API (`/api/dashboard`, `/api/state`, `/api/clients`) возвращают корректные данные. Проблема в клиентском коде React — требуется исправление в компонентах дашборда.

Серверная часть полностью функциональна: все API-эндпоинты работают, авторизация через JWT, управление клиентами и сервером доступно через REST API.

---

## 🇬 In English

**MarkAmni WG Web Panel** is a modern web panel for managing AmneziaWG 3.1 and WireGuard VPN servers.

### Features
- 🚀 **Full AmneziaWG 3.1 support** — all obfuscation parameters (Jc, Jmin, Jmax, S1-S4, H1-H4, I1-I5, HeaderProtectionKey, etc.)
- 👥 **Client management** — create, delete, enable/disable peers
- 📱 **QR codes & configs** — instant generation of configs and QR codes for AmneziaVPN import
- 🔒 **Security** — JWT-based authentication
- 🎨 **Modern UI** — dark theme, responsive design, Tailwind CSS 4
- 📊 **Statistics** — connection, CPU, RAM, disk monitoring
- 🛠 **Easy installation** — single script for deployment

### Quick Start

```bash
# Clone repository
git clone https://github.com/Maarkevich/MarkAmni-WG-Web-Panel.git
cd MarkAmni-WG-Web-Panel

# Install dependencies
bun install

# Configure environment
echo "NEXTAUTH_SECRET=your-secret-key" > .env
echo "NEXTAUTH_URL=http://localhost:3080" >> .env
echo "PORT=3080" >> .env

# Build and run
bun run build
bun run start
```

Panel will be available at `http://localhost:3080`.

On first launch, the panel automatically creates an admin user:
- Username: `admin`
- Password: auto-generated (see logs or `data/panel/initial-credentials.txt`)

### ⚠️ Known Issues

As of version 1.0.0, there is a dashboard rendering bug: after authentication, the UI shows a loading spinner even though APIs (`/api/dashboard`, `/api/state`, `/api/clients`) return valid data. The issue is in the React client code — dashboard components need fixing.

The server-side is fully functional: all API endpoints work, JWT authentication is operational, client and server management is available via REST API.

---

## 📸 Screenshots

### Dashboard (with known rendering issue)
![Dashboard](screenshots/dashboard.jpg)

*Note: The dashboard currently shows a loading spinner due to a client-side rendering bug. API responses are correct.*

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Auth**: JWT tokens (custom implementation)
- **Runtime**: Bun / Node.js
- **VPN**: AmneziaWG 3.1 / WireGuard
- **Storage**: JSON file-based (no external DB required)

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ by Maarkevich**

</content>