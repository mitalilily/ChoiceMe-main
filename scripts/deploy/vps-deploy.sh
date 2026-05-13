#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/choicemee}"
SOURCE_DIR="${SOURCE_DIR:-$APP_ROOT/source}"
SHARED_DIR="${SHARED_DIR:-$APP_ROOT/shared}"
WEB_ROOT="${WEB_ROOT:-/var/www/choicemee}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$SHARED_DIR/backend.env}"

ROOT_DOMAIN="${ROOT_DOMAIN:-choicemee.in}"
APP_DOMAIN="${APP_DOMAIN:-app.choicemee.in}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.choicemee.in}"
API_DOMAIN="${API_DOMAIN:-api.choicemee.in}"
PGADMIN_DOMAIN="${PGADMIN_DOMAIN:-pgadmin.choicemee.in}"

PUBLIC_LANDING_URL="https://${ROOT_DOMAIN}"
PUBLIC_APP_URL="https://${APP_DOMAIN}"
PUBLIC_ADMIN_URL="https://${ADMIN_DOMAIN}"
PUBLIC_API_URL="https://${API_DOMAIN}"
BACKEND_PORT="${BACKEND_PORT:-5012}"
PGADMIN_PORT="${PGADMIN_PORT:-5051}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

log() {
  printf '\n[choicemee-deploy] %s\n' "$*"
}

need_command() {
  command -v "$1" >/dev/null 2>&1
}

install_base_packages() {
  local packages=()
  for package in curl rsync ca-certificates; do
    need_command "$package" || packages+=("$package")
  done

  if [ "${#packages[@]}" -gt 0 ]; then
    log "Installing base packages: ${packages[*]}"
    $SUDO apt-get update
    $SUDO apt-get install -y "${packages[@]}"
  fi
}

install_node_if_missing() {
  if need_command node && node --version | grep -Eq '^v(20|22|24)\.'; then
    return
  fi

  log "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y nodejs
}

ensure_pm2() {
  if ! need_command pm2; then
    log "Installing PM2"
    $SUDO npm install -g pm2
  fi
}

ensure_backend_env() {
  if [ ! -f "$BACKEND_ENV_FILE" ]; then
    cat >&2 <<EOF
Missing backend env file: $BACKEND_ENV_FILE

Create it on the VPS with the backend environment values before running deploy.
GitHub Actions can write it automatically from the BACKEND_ENV_B64 secret.
EOF
    exit 1
  fi
}

npm_clean_install() {
  local extra_args=("$@")
  if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    npm ci "${extra_args[@]}"
  else
    npm install "${extra_args[@]}"
  fi
}

build_backend() {
  log "Building backend"
  cd "$SOURCE_DIR/apps/backend"
  npm_clean_install
  npm run build
}

build_landing() {
  log "Building landing page"
  cd "$SOURCE_DIR/apps/landing-page"
  npm_clean_install
  VITE_API_BASE_URL="$PUBLIC_API_URL" \
    VITE_CLIENT_AUTH_URL="$PUBLIC_APP_URL/login" \
    npm run build
  $SUDO mkdir -p "$WEB_ROOT/landing"
  $SUDO rsync -a --delete dist/ "$WEB_ROOT/landing/"
}

build_client() {
  log "Building client app"
  cd "$SOURCE_DIR/apps/client"
  npm_clean_install
  VITE_API_URL="$PUBLIC_API_URL/api" \
    VITE_APP_SOCKET_URL="$PUBLIC_API_URL" \
    npm run build
  $SUDO mkdir -p "$WEB_ROOT/app"
  $SUDO rsync -a --delete dist/ "$WEB_ROOT/app/"
}

build_admin() {
  log "Building admin app"
  cd "$SOURCE_DIR/apps/admin"
  npm_clean_install --legacy-peer-deps
  REACT_APP_API_BASE_URL="$PUBLIC_API_URL/api" \
    REACT_APP_SOCKET_URL="$PUBLIC_API_URL" \
    npm run build
  $SUDO mkdir -p "$WEB_ROOT/admin"
  $SUDO rsync -a --delete build/ "$WEB_ROOT/admin/"
}

start_backend() {
  log "Starting backend with PM2"
  set -a
  # shellcheck disable=SC1090
  . "$BACKEND_ENV_FILE"
  set +a

  export NODE_ENV="${DEPLOY_NODE_ENV:-production}"
  export PORT="$BACKEND_PORT"
  export API_URL="$PUBLIC_API_URL"
  export FRONTEND_URL="$PUBLIC_APP_URL"
  export ADMIN_URL="$PUBLIC_ADMIN_URL"
  export CORS_ORIGINS="$PUBLIC_APP_URL,$PUBLIC_ADMIN_URL,$PUBLIC_LANDING_URL,https://www.$ROOT_DOMAIN"
  export CORS_ALLOWED_ORIGINS="$CORS_ORIGINS"
  export SMTP_PORT="${SMTP_PORT:-465}"
  export SMTP_SECURE="${SMTP_SECURE:-true}"

  cd "$SOURCE_DIR/apps/backend"
  pm2 delete choicemee-api >/dev/null 2>&1 || true
  pm2 start dist/index.js --name choicemee-api --cwd "$SOURCE_DIR/apps/backend" --update-env
  pm2 save
}

configure_nginx() {
  if ! need_command nginx; then
    log "Installing Nginx"
    $SUDO apt-get update
    $SUDO apt-get install -y nginx
  fi

  log "Writing isolated Nginx site for ChoiceMee"
  $SUDO tee /etc/nginx/sites-available/choicemee.conf >/dev/null <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;
  server_name $ROOT_DOMAIN www.$ROOT_DOMAIN;
  root $WEB_ROOT/landing;
  index index.html;
  location / {
    try_files \$uri \$uri/ /index.html;
  }
}

server {
  listen 80;
  server_name $APP_DOMAIN;
  root $WEB_ROOT/app;
  index index.html;
  location / {
    try_files \$uri \$uri/ /index.html;
  }
}

server {
  listen 80;
  server_name $ADMIN_DOMAIN;
  root $WEB_ROOT/admin;
  index index.html;
  location / {
    try_files \$uri \$uri/ /index.html;
  }
}

server {
  listen 80;
  server_name $API_DOMAIN;
  location / {
    proxy_pass http://127.0.0.1:$BACKEND_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
  }
}

server {
  listen 80;
  server_name $PGADMIN_DOMAIN;
  location / {
    proxy_pass http://127.0.0.1:$PGADMIN_PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  $SUDO ln -sfn /etc/nginx/sites-available/choicemee.conf /etc/nginx/sites-enabled/choicemee.conf
  $SUDO nginx -t
  $SUDO systemctl reload nginx || $SUDO systemctl restart nginx

  if ! need_command certbot; then
    log "Installing Certbot for HTTPS"
    $SUDO apt-get update
    $SUDO apt-get install -y certbot python3-certbot-nginx
  fi

  log "Requesting HTTPS certificates with Certbot"
  $SUDO certbot --nginx --non-interactive --agree-tos --redirect \
    -m "admin@$ROOT_DOMAIN" \
    -d "$ROOT_DOMAIN" -d "www.$ROOT_DOMAIN" -d "$APP_DOMAIN" -d "$ADMIN_DOMAIN" -d "$API_DOMAIN" || true
}

configure_caddy() {
  log "Writing isolated Caddy snippet for ChoiceMee"
  $SUDO mkdir -p /etc/caddy/conf.d
  $SUDO tee /etc/caddy/conf.d/choicemee.caddy >/dev/null <<EOF
$ROOT_DOMAIN, www.$ROOT_DOMAIN {
  encode gzip zstd
  root * $WEB_ROOT/landing
  try_files {path} /index.html
  file_server
}

$APP_DOMAIN {
  encode gzip zstd
  root * $WEB_ROOT/app
  try_files {path} /index.html
  file_server
}

$ADMIN_DOMAIN {
  encode gzip zstd
  root * $WEB_ROOT/admin
  try_files {path} /index.html
  file_server
}

$API_DOMAIN {
  encode gzip zstd
  reverse_proxy 127.0.0.1:$BACKEND_PORT
}

$PGADMIN_DOMAIN {
  reverse_proxy 127.0.0.1:$PGADMIN_PORT
}
EOF

  if ! grep -q 'import /etc/caddy/conf.d/\*.caddy' /etc/caddy/Caddyfile; then
    $SUDO cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup.$(date +%Y%m%d%H%M%S)"
    printf '\nimport /etc/caddy/conf.d/*.caddy\n' | $SUDO tee -a /etc/caddy/Caddyfile >/dev/null
  fi

  $SUDO caddy fmt --overwrite /etc/caddy/conf.d/choicemee.caddy
  $SUDO caddy validate --config /etc/caddy/Caddyfile
  $SUDO systemctl reload caddy || $SUDO systemctl restart caddy
}

configure_proxy() {
  if need_command caddy && systemctl is-active --quiet caddy; then
    configure_caddy
  else
    configure_nginx
  fi
}

setup_pgadmin() {
  if [ -z "${PGADMIN_PASSWORD:-}" ]; then
    log "Skipping pgAdmin because PGADMIN_PASSWORD is not set."
    return
  fi

  if ! need_command docker; then
    log "Skipping pgAdmin because Docker is not installed."
    return
  fi

  local pgadmin_dir="$SHARED_DIR/pgadmin"
  local pgadmin_volume_args=()
  $SUDO mkdir -p "$pgadmin_dir"

  if [ -n "${DATABASE_URL:-}" ]; then
    log "Writing pgAdmin server registration from DATABASE_URL"
    if DATABASE_URL="$DATABASE_URL" PGSSLMODE="${PGSSLMODE:-require}" node <<'NODE' | $SUDO tee "$pgadmin_dir/servers.json" >/dev/null; then
const databaseUrl = new URL(process.env.DATABASE_URL)
const databaseName = databaseUrl.pathname.replace(/^\//, '') || 'postgres'
const username = decodeURIComponent(databaseUrl.username || '')

if (!databaseUrl.hostname || !username) {
  throw new Error('DATABASE_URL must include host and username')
}

const servers = {
  Servers: {
    1: {
      Name: 'ChoiceMee Postgres',
      Group: 'ChoiceMee',
      Host: databaseUrl.hostname,
      Port: Number(databaseUrl.port || 5432),
      MaintenanceDB: databaseName,
      Username: username,
      SSLMode: process.env.PGSSLMODE || databaseUrl.searchParams.get('sslmode') || 'prefer'
    }
  }
}

console.log(JSON.stringify(servers, null, 2))
NODE
      pgadmin_volume_args=(-v "$pgadmin_dir/servers.json:/pgadmin4/servers.json:ro")
    else
      log "Could not parse DATABASE_URL for pgAdmin; starting pgAdmin without a preloaded server."
    fi
  fi

  log "Starting isolated pgAdmin container"
  docker rm -f choicemee-pgadmin >/dev/null 2>&1 || true
  docker run -d \
    --name choicemee-pgadmin \
    --restart unless-stopped \
    -p 127.0.0.1:$PGADMIN_PORT:80 \
    -e "PGADMIN_DEFAULT_EMAIL=${PGADMIN_EMAIL:-admin@$ROOT_DOMAIN}" \
    -e "PGADMIN_DEFAULT_PASSWORD=$PGADMIN_PASSWORD" \
    "${pgadmin_volume_args[@]}" \
    dpage/pgadmin4:latest >/dev/null
}

main() {
  log "Deploying ChoiceMee from $SOURCE_DIR"
  install_base_packages
  install_node_if_missing
  ensure_pm2
  ensure_backend_env
  build_backend
  build_landing
  build_client
  build_admin
  start_backend
  setup_pgadmin
  configure_proxy

  log "Deployment complete"
  printf 'Landing: %s\nApp: %s\nAdmin: %s\nAPI: %s\npgAdmin: https://%s\n' \
    "$PUBLIC_LANDING_URL" "$PUBLIC_APP_URL" "$PUBLIC_ADMIN_URL" "$PUBLIC_API_URL" "$PGADMIN_DOMAIN"
}

main "$@"
