#!/usr/bin/env bash
# ============================================================
#  AmneziaWG Panel — установщик для VPS (Ubuntu / Debian)
#
#  Что делает:
#   1. Ставит зависимости (Node.js 20, утилиты, kernel headers)
#   2. Устанавливает модуль ядра AmneziaWG (DKMS) из ppa:amnezia/ppa
#      — поддержка AWG 1.5 / 2.0 / 3.1 (awg, awg-quick)
#   3. Собирает и разворачивает панель в /opt/awg-panel,
#      создает systemd-сервис
#   4. Автоматически создает логин и пароль главного администратора
#      (печатает в консоль и сохраняет в data/panel/initial-credentials.txt)
#   5. По желанию: Nginx + бесплатный SSL (Let's Encrypt) для домена
#   6. Включает ip_forward и открывает порты в UFW
#
#  Использование (из папки с проектом):
#      sudo bash install.sh
#  Опции:
#      --domain vpn.example.com   домен панели (включит Nginx + SSL)
#      --email you@mail.ru        почта для Let's Encrypt
#      --port 3080                порт панели (по умолчанию 3080)
#      --vpn-port 51820           UDP-порт AmneziaWG
#      --yes                      без вопросов (все значения по умолчанию)
# ============================================================
set -euo pipefail

# ---------- Цвета ----------
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'
info()  { echo -e "${C}[i]${N} $*"; }
ok()    { echo -e "${G}[✓]${N} $*"; }
warn()  { echo -e "${Y}[!]${N} $*"; }
fail()  { echo -e "${R}[✗]${N} $*"; exit 1; }

# ---------- Парсинг аргументов ----------
DOMAIN="" ; EMAIL="" ; PANEL_PORT="${PANEL_PORT:-3080}" ; VPN_PORT="${VPN_PORT:-51820}" ; AUTO=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)  DOMAIN="$2"; shift 2 ;;
    --email)   EMAIL="$2"; shift 2 ;;
    --port)    PANEL_PORT="$2"; shift 2 ;;
    --vpn-port) VPN_PORT="$2"; shift 2 ;;
    --yes|-y)  AUTO=1; shift ;;
    *) warn "Неизвестный аргумент: $1"; shift ;;
  esac
done

[[ $EUID -ne 0 ]] && fail "Запустите от root: sudo bash install.sh"

# ---------- Определение системы ----------
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS="${ID:-unknown}" ; VER="${VERSION_ID:-0}"
else
  fail "Не удалось определить ОС (нужен Ubuntu или Debian)"
fi
[[ "$OS" != "ubuntu" && "$OS" != "debian" ]] && fail "Поддерживаются Ubuntu и Debian (обнаружено: $OS)"
ARCH=$(dpkg --print-architecture)
info "Система: ${PRETTY_NAME:-$OS $VER} ($ARCH)"

SERVER_IP=$(curl -s4 --max-time 8 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
DEFAULT_IFACE=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $5; exit}')
[[ -z "$DEFAULT_IFACE" ]] && DEFAULT_IFACE="eth0"
info "Внешний IP: ${SERVER_IP:-неопределён}, WAN-интерфейс: $DEFAULT_IFACE"

if [[ $AUTO -eq 0 && -z "$DOMAIN" ]]; then
  read -r -p "Домен панели для Nginx + SSL (Enter = доступ по IP:$PANEL_PORT): " DOMAIN_IN
  DOMAIN="${DOMAIN_IN:-}"
  if [[ -n "$DOMAIN" ]]; then
    read -r -p "E-mail для Let's Encrypt: " EMAIL_IN; EMAIL="${EMAIL_IN:-admin@${DOMAIN}}"
  fi
fi

# ---------- 1. Системные зависимости ----------
echo -e "\n${B}=== [1/7] Системные зависимости ===${N}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq curl wget git ca-certificates openssl rsync iptables \
  software-properties-common gnupg2 dkms build-essential \
  "linux-headers-$(uname -r)" >/dev/null 2>&1 || {
  warn "Не удалось поставить linux-headers-$(uname -r) — пробуем общий пакет"
  apt-get install -y -qq linux-headers-generic >/dev/null 2>&1 || true
}
ok "Базовые пакеты установлены"

# ---------- 2. Node.js 20+ ----------
echo -e "\n${B}=== [2/7] Node.js ===${N}"
node_major() { node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0; }
if command -v node >/dev/null 2>&1 && [[ "$(node_major)" -ge 20 ]]; then
  ok "Node.js $(node -v) уже установлен"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null 2>&1
  ok "Установлен Node.js $(node -v)"
fi

# ---------- 3. Модуль ядра AmneziaWG ----------
echo -e "\n${B}=== [3/7] Модуль ядра AmneziaWG (AWG 1.5 / 2.0 / 3.1) ===${N}"
AWG_OK=0
if modinfo amneziawg >/dev/null 2>&1; then
  ok "Модуль amneziawg уже установлен ($(modinfo -F version amneziawg 2>/dev/null))"
  AWG_OK=1
else
  if [[ "$OS" == "ubuntu" ]]; then
    info "Добавляю PPA amnezia/ppa…"
    add-apt-repository -y ppa:amnezia/ppa >/dev/null 2>&1 || warn "add-apt-repository завершился с предупреждением"
  else
    info "Debian: подключаю PPA вручную…"
    echo "deb https://ppa.launchpadcontent.net/amnezia/ppa/ubuntu focal main" > /etc/apt/sources.list.d/amneziawg.list
    echo "deb-src https://ppa.launchpadcontent.net/amnezia/ppa/ubuntu focal main" >> /etc/apt/sources.list.d/amneziawg.list
    apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 57290828 >/dev/null 2>&1 || true
  fi
  apt-get update -y -qq || true
  if apt-get install -y -qq amneziawg amneziawg-tools >/dev/null 2>&1; then
    ok "Пакет amneziawg (DKMS-модуль + утилиты awg/awg-quick) установлен"
    AWG_OK=1
  else
    warn "Пакет не установился — пробую сборку модуля из исходников"
    SRC=/usr/local/src/amneziawg-linux-kernel-module
    [[ -d $SRC ]] || git clone -q https://github.com/amnezia-vpn/amneziawg-linux-kernel-module.git "$SRC"
    ( cd "$SRC/src"
      [[ -e kernel ]] || ln -s /lib/modules/"$(uname -r)"/build kernel 2>/dev/null || true
      make >/dev/null 2>&1 && make install >/dev/null 2>&1 && AWG_OK=1 ) || true
    [[ $AWG_OK -eq 1 ]] && ok "Модуль собран из исходников" || warn "Сборка модуля не удалась — панель будет работать в режиме конфигуратора"
  fi
fi
if [[ $AWG_OK -eq 1 ]]; then
  modprobe amneziawg 2>/dev/null || warn "Не удалось загрузить модуль сейчас (перезагрузка поможет)"
  echo "amneziawg" > /etc/modules-load.d/amneziawg.conf
  command -v awg >/dev/null 2>&1 && ok "Утилита awg: $(awg --version 2>/dev/null | head -1)"
else
  warn "AWG не установлен: панель продолжит работу в режиме конфигуратора (конфиги, QR, vpn:// — работают)"
fi

# ---------- 4. Установка панели ----------
echo -e "\n${B}=== [4/7] Установка панели ===${N}"
PANEL_DIR=/opt/awg-panel
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SRC_DIR/package.json" ]] || fail "Запускайте install.sh из папки с проектом панели (package.json не найден)"
mkdir -p "$PANEL_DIR"
rsync -a --exclude node_modules --exclude data/panel/db.json --exclude data/panel/jwt.secret \
  --exclude .git --exclude .next --exclude dev.log "$SRC_DIR"/ "$PANEL_DIR"/ 2>/dev/null || {
  cp -r "$SRC_DIR"/. "$PANEL_DIR"/
  rm -rf "$PANEL_DIR/node_modules" "$PANEL_DIR/.next"
}
cd "$PANEL_DIR"
mkdir -p data/panel

# Автоматические учётные данные главного администратора
if [[ -f data/panel/db.json ]] && grep -q '"username"' data/panel/db.json 2>/dev/null; then
  info "Существующая база найдена — учётные данные не перезаписываются"
  ADMIN_USER="${ADMIN_USER:-admin}"; ADMIN_PASS="(см. ранее / файл data/panel/initial-credentials.txt)"
else
  ADMIN_USER="${ADMIN_USER:-admin}"
  ADMIN_PASS="${ADMIN_PASS:-$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)}"
fi

cat > "$PANEL_DIR/.env.production" <<EOF
# AmneziaWG Panel — конфигурация окружения
NODE_ENV=production
PORT=$PANEL_PORT
HOSTNAME=127.0.0.1
PANEL_DATA_DIR=$PANEL_DIR/data/panel
SERVER_IP=$SERVER_IP
VPN_PORT=$VPN_PORT
ADMIN_USER=$ADMIN_USER
ADMIN_PASS=$ADMIN_PASS
NEXT_TELEMETRY_DISABLED=1
EOF
chmod 600 "$PANEL_DIR/.env.production"
ok "Конфигурация записана: $PANEL_DIR/.env.production"

# Сборка: при нехватке RAM временно добавляем swap
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
CREATED_SWAP=0
if [[ "$TOTAL_RAM_MB" -lt 1800 ]]; then
  if ! swapon --show | grep -q .; then
    warn "Мало RAM (${TOTAL_RAM_MB} МБ) — создаю временный swap 2 ГБ для сборки"
    fallocate -l 2G /swapfile-awg-panel && chmod 600 /swapfile-awg-panel && mkswap /swapfile-awg-panel >/dev/null && swapon /swapfile-awg-panel
    CREATED_SWAP=1
  fi
fi

if [[ ! -d node_modules ]]; then
  npm install --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund
  ok "Зависимости установлены"
fi
info "Собираю панель (next build) — это может занять пару минут…"
npm run build >/dev/null 2>&1 || fail "Сборка не удалась. Запустите вручную: cd $PANEL_DIR && npm run build"
ok "Панель собрана"
[[ $CREATED_SWAP -eq 1 ]] && { swapoff /swapfile-awg-panel && rm -f /swapfile-awg-panel; ok "Временный swap удалён"; }

# ---------- 5. systemd + firewall + sysctl ----------
echo -e "\n${B}=== [5/7] Сервис, firewall, маршрутизация ===${N}"
cat > /etc/systemd/system/awg-panel.service <<EOF
[Unit]
Description=AmneziaWG Panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$PANEL_DIR
EnvironmentFile=$PANEL_DIR/.env.production
ExecStart=/usr/bin/node $PANEL_DIR/.next/standalone/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now awg-panel.service >/dev/null 2>&1
ok "Сервис awg-panel запущен (systemctl status awg-panel)"

# ip_forward для туннеля
if [[ "$(cat /proc/sys/net/ipv4/ip_forward)" != "1" ]]; then
  echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-awg-panel.conf
  sysctl -p /etc/sysctl.d/99-awg-panel.conf >/dev/null 2>&1
  ok "Включён ip_forward"
else
  ok "ip_forward уже включён"
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow ssh >/dev/null 2>&1 || true
  ufw allow "$PANEL_PORT/tcp" >/dev/null 2>&1 || true
  ufw allow "$VPN_PORT/udp" >/dev/null 2>&1 || true
  [[ -n "$DOMAIN" ]] && { ufw allow 80/tcp >/dev/null 2>&1 || true; ufw allow 443/tcp >/dev/null 2>&1 || true; }
  ok "Порты открыты в UFW: $PANEL_PORT/tcp, $VPN_PORT/udp"
else
  info "UFW неактивен — firewall не изменялся (проверьте порты у провайдера)"
fi

# ---------- 6. Nginx + SSL (если домен) ----------
echo -e "\n${B}=== [6/7] Nginx и SSL ===${N}"
if [[ -n "$DOMAIN" ]]; then
  apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null 2>&1
  cat > /etc/nginx/sites-available/awg-panel <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 8m;
    location / {
        proxy_pass http://127.0.0.1:$PANEL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/awg-panel /etc/nginx/sites-enabled/awg-panel
  rm -f /etc/nginx/sites-enabled/default
  nginx -t >/dev/null 2>&1 && systemctl reload nginx && ok "Nginx настроен: $DOMAIN → 127.0.0.1:$PANEL_PORT"
  info "Получаю SSL-сертификат Let's Encrypt для $DOMAIN…"
  if certbot --nginx -d "$DOMAIN" -m "${EMAIL:-admin@$DOMAIN}" --non-interactive --agree-tos --redirect >/dev/null 2>&1; then
    ok "SSL-сертификат получен, включён автоматический редирект на HTTPS"
    sed -i "s/^PORT=.*/PORT=$PANEL_PORT/" "$PANEL_DIR/.env.production"
    PANEL_URL="https://$DOMAIN"
  else
    warn "Certbot не смог выпустить сертификат (проверьте DNS-запись A → $SERVER_IP). Повторите позже: sudo certbot --nginx -d $DOMAIN"
    PANEL_URL="http://$DOMAIN"
  fi
else
  # Без домена панель слушает на всех интерфейсах напрямую
  sed -i "s/^HOSTNAME=.*/HOSTNAME=0.0.0.0/" "$PANEL_DIR/.env.production"
  PANEL_URL="http://$SERVER_IP:$PANEL_PORT"
  info "Домен не задан — панель доступна напрямую по IP:$PANEL_PORT"
  info "SSL можно добавить позже: sudo bash install.sh --domain ваш.домен --email почта"
fi
systemctl restart awg-panel >/dev/null 2>&1 || true

# ---------- 7. Готово ----------
sleep 2
CRED_FILE="$PANEL_DIR/data/panel/initial-credentials.txt"
systemctl is-active --quiet awg-panel && SVC="${G}активен${N}" || SVC="${R}не запустился${N}"

echo -e "\n================================================================="
echo -e "${G}${B}  AmneziaWG Panel установлена!${N}"
echo -e "================================================================="
echo -e "  Адрес панели : ${B}$PANEL_URL${N}"
echo -e "  Логин        : ${B}$ADMIN_USER${N}"
echo -e "  Пароль       : ${B}$ADMIN_PASS${N}"
echo -e "  UDP-порт VPN : ${B}$VPN_PORT${N}  (откройте его у провайдера!)"
echo -e "  Сервис       : $SVC  (systemctl status awg-panel)"
echo -e "================================================================="
echo -e "  Дальше:"
echo -e "   1. Войдите и смените пароль: «Администраторы» → «Профиль»"
echo -e "   2. Создайте клиентов в разделе «Клиенты»"
echo -e "   3. Кнопка «Применить на сервере» поднимет интерфейс awg0"
echo -e "   4. Telegram-бот: раздел «Telegram» (токен от @BotFather)"
echo -e "  Учётные данные также сохранены в: ${C}$CRED_FILE${N}"
echo -e "================================================================="
