#!/usr/bin/env bash
# ============================================================
#  MarkAmni WG Web Panel — установщик
#  Поддерживаемые ОС: Ubuntu 22.04 / 24.04 (amd64)
#  Запуск: bash <(curl -fsSL https://raw.githubusercontent.com/Maarkevich/MarkAmni-WG-Web-Panel/main/install.sh)
# ============================================================
set -euo pipefail

# ── Цвета ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[•]${RESET} $*"; }
success() { echo -e "${GREEN}[✓]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $*"; }
error()   { echo -e "${RED}[✗]${RESET} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${RESET}"; }

# ── Проверка root ─────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Запустите скрипт от root: sudo bash install.sh"

# ── Константы ─────────────────────────────────────────────────
PANEL_DIR="/opt/MarkAmni-WG-Web-Panel"
PANEL_PORT="${PANEL_PORT:-3080}"
AWG_PORT="${AWG_PORT:-51820}"
AWG_IFACE="awg0"
AWG_CONF="/etc/amnezia/amneziawg/${AWG_IFACE}.conf"
SERVICE_NAME="markamni-panel"
REPO_URL="https://github.com/Maarkevich/MarkAmni-WG-Web-Panel.git"

# Определить внешний IP и интерфейс
SERVER_IP=$(curl -s4 --connect-timeout 5 https://api.ipify.org || hostname -I | awk '{print $1}')
WAN_IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -1)

# ── Баннер ────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗ █████╗ ███╗   ███╗███╗   ██╗██╗"
echo "  ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔══██╗████╗ ████║████╗  ██║██║"
echo "  ██╔████╔██║███████║██████╔╝█████╔╝ ███████║██╔████╔██║██╔██╗ ██║██║"
echo "  ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══██║██║╚██╔╝██║██║╚██╗██║██║"
echo "  ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗██║  ██║██║ ╚═╝ ██║██║ ╚████║██║"
echo "  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝"
echo -e "${RESET}"
echo -e "  ${BOLD}WG Web Panel — установщик${RESET}"
echo -e "  Сервер: ${YELLOW}${SERVER_IP}${RESET}  |  Интерфейс: ${YELLOW}${WAN_IFACE}${RESET}"
echo -e "  Порт панели: ${YELLOW}${PANEL_PORT}${RESET}  |  Порт AWG: ${YELLOW}${AWG_PORT}/UDP${RESET}"
echo ""

# ── 1. Системные зависимости ──────────────────────────────────
step "1/7 Установка системных зависимостей"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
    curl wget git unzip ca-certificates gnupg \
    iptables iptables-persistent netfilter-persistent \
    iproute2 procps lsb-release \
    2>&1 | grep -E "^\(Reading|Unpacking|Setting up" || true

success "Системные пакеты установлены"

# ── 2. AmneziaWG ──────────────────────────────────────────────
step "2/7 Установка AmneziaWG 3.1"

if ! command -v awg &>/dev/null; then
    add-apt-repository -y ppa:amnezia/ppa -qq
    apt-get update -qq
    apt-get install -y -qq amneziawg amneziawg-tools
    success "AmneziaWG $(awg --version 2>/dev/null | head -1) установлен"
else
    success "AmneziaWG уже установлен: $(awg --version 2>/dev/null | head -1)"
fi

# Включить ip_forward
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-awg.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.d/99-awg.conf
sysctl -p /etc/sysctl.d/99-awg.conf -q

# ── 3. Node.js 20 ─────────────────────────────────────────────
step "3/7 Установка Node.js 20"

if ! node --version 2>/dev/null | grep -q "v20"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -q
    apt-get install -y -qq nodejs
fi
success "Node.js $(node --version) установлен"

# ── 4. Bun ────────────────────────────────────────────────────
step "4/7 Установка Bun"

export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun &>/dev/null; then
    curl -fsSL https://bun.sh/install | bash -s -- --no-interactive
fi
success "Bun $(bun --version) установлен"

# ── 5. Клонирование и сборка панели ───────────────────────────
step "5/7 Установка панели MarkAmni WG Web Panel"

if [[ -d "$PANEL_DIR/.git" ]]; then
    info "Обновление существующей установки..."
    cd "$PANEL_DIR"
    git pull -q origin main
else
    info "Клонирование репозитория..."
    rm -rf "$PANEL_DIR"
    git clone -q "$REPO_URL" "$PANEL_DIR"
    cd "$PANEL_DIR"
fi

# Генерация секрета
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# .env файл
cat > "$PANEL_DIR/.env" << ENV
NODE_ENV=production
PORT=${PANEL_PORT}
NEXTAUTH_URL=http://${SERVER_IP}:${PANEL_PORT}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
SERVER_IP=${SERVER_IP}
AWG_PORT=${AWG_PORT}
WAN_IFACE=${WAN_IFACE}
ENV

info "Установка зависимостей..."
bun install --production --frozen-lockfile -q 2>/dev/null || bun install -q

info "Сборка Next.js..."
bun run build

# Очистка node_modules после сборки (не нужны в production)
rm -rf node_modules

success "Панель собрана"

# ── 6. AmneziaWG конфиг и запуск ─────────────────────────────
step "6/7 Настройка AmneziaWG"

mkdir -p "$(dirname "$AWG_CONF")"

if [[ ! -f "$AWG_CONF" ]]; then
    info "Генерация серверных ключей AWG..."
    SERVER_PRIV=$(awg genkey)
    SERVER_PUB=$(echo "$SERVER_PRIV" | awg pubkey)

    # Параметры обфускации AWG 3.1
    HPK=$(openssl rand -base64 32)
    JC=$((RANDOM % 5 + 4))
    JMIN=$((RANDOM % 30 + 30))
    JMAX=$((JMIN + RANDOM % 100 + 50))
    S1=$((RANDOM % 50 + 16))
    S2=$((RANDOM % 50 + 16))
    S3=$((RANDOM % 30 + 12))
    S4=$((RANDOM % 20 + 10))
    H1S=$((RANDOM * RANDOM % 200000000 + 100000000))
    H2S=$((RANDOM * RANDOM % 200000000 + 400000000))
    H3S=$((RANDOM * RANDOM % 200000000 + 700000000))
    H4S=$((RANDOM * RANDOM % 200000000 + 1000000000))
    H1D=$((RANDOM % 200000 + 50000))
    H2D=$((RANDOM % 200000 + 50000))
    H3D=$((RANDOM % 200000 + 50000))
    H4D=$((RANDOM % 200000 + 50000))

    cat > "$AWG_CONF" << AWG
# Сгенерировано MarkAmni WG Web Panel
[Interface]
Address = 10.8.1.1/24
ListenPort = ${AWG_PORT}
PrivateKey = ${SERVER_PRIV}
MTU = 1280

# Параметры маскировки AmneziaWG 3.1
Jc = ${JC}
Jmin = ${JMIN}
Jmax = ${JMAX}
S1 = ${S1}
S2 = ${S2}
S3 = ${S3}
S4 = ${S4}
H1 = ${H1S}-$((H1S + H1D))
H2 = ${H2S}-$((H2S + H2D))
H3 = ${H3S}-$((H3S + H3D))
H4 = ${H4S}-$((H4S + H4D))
I1 = <b 0xc00000000108><r 16><t><r 24>
I2 = <b 0x40><t><r 12>
HeaderProtectionKey = ${HPK}
ContentPaddingAddition = 8-64
RekeyAfterTime = 115-145
RekeyTimeout = 4-7
RejectAfterTime = 170-210
KeepaliveTimeout = 20-35
MaxHandshakeAttempts = 15-25
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${WAN_IFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${WAN_IFACE} -j MASQUERADE
AWG
    chmod 600 "$AWG_CONF"
    success "Конфиг AWG создан (PublicKey: ${SERVER_PUB})"
else
    success "Конфиг AWG уже существует, пропускаем"
fi

# Поднять интерфейс
awg-quick down "$AWG_IFACE" 2>/dev/null || true
awg-quick up "$AWG_IFACE"
systemctl enable "awg-quick@${AWG_IFACE}" -q
success "Интерфейс ${AWG_IFACE} активен"

# ── 7. Systemd-сервис панели ──────────────────────────────────
step "7/7 Запуск панели через systemd"

cat > "/etc/systemd/system/${SERVICE_NAME}.service" << SVC
[Unit]
Description=MarkAmni WG Web Panel
After=network.target awg-quick@${AWG_IFACE}.service

[Service]
Type=simple
WorkingDirectory=${PANEL_DIR}
EnvironmentFile=${PANEL_DIR}/.env
Environment=PATH=/root/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/root/.bun/bin/bun .next/standalone/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" -q
systemctl restart "$SERVICE_NAME"

# Ждём запуска и читаем пароль
info "Ожидание запуска панели..."
for i in $(seq 1 15); do
    if curl -sf "http://localhost:${PANEL_PORT}/api/health" &>/dev/null; then
        break
    fi
    sleep 1
done

# Читаем сгенерированный пароль
CREDS_FILE="$PANEL_DIR/.next/standalone/data/panel/initial-credentials.txt"
PANEL_PASS=""
for i in $(seq 1 10); do
    if [[ -f "$CREDS_FILE" ]]; then
        PANEL_PASS=$(grep -i "пароль\|Password\|пароль" "$CREDS_FILE" | awk '{print $NF}' | head -1)
        [[ -n "$PANEL_PASS" ]] && break
    fi
    sleep 1
done

# Сохранить firewall
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

# ── Итоговый вывод ────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}┌─────────────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}${GREEN}│        MarkAmni WG Web Panel установлена!       │${RESET}"
echo -e "${BOLD}${GREEN}└─────────────────────────────────────────────────┘${RESET}"
echo ""
echo -e "  ${BOLD}🌐 Адрес панели:${RESET}  ${CYAN}http://${SERVER_IP}:${PANEL_PORT}${RESET}"
echo ""
echo -e "  ${BOLD}🔑 Учётные данные:${RESET}"
echo -e "     Логин:  ${YELLOW}admin${RESET}"
echo -e "     Пароль: ${YELLOW}${PANEL_PASS:-см. файл .next/standalone/data/panel/initial-credentials.txt}${RESET}"
echo ""
echo -e "  ${BOLD}🛡️  AmneziaWG:${RESET}"
echo -e "     Интерфейс: ${GREEN}${AWG_IFACE} (активен)${RESET}"
echo -e "     Порт:      ${YELLOW}${AWG_PORT}/UDP${RESET}"
echo ""
echo -e "  ${BOLD}${RED}⚠️  Важно:${RESET} Сохраните логин и пароль!"
echo -e "     После первого входа смените пароль:"
echo -e "     ${CYAN}Администраторы → Профиль → Сменить пароль${RESET}"
echo ""
echo -e "  Файл с паролем: ${CYAN}${CREDS_FILE}${RESET}"
echo ""
echo -e "${BOLD}${GREEN}─────────────────────────────────────────────────────${RESET}"
echo ""
