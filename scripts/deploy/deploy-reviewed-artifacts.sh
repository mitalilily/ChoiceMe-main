#!/usr/bin/env bash
set -euo pipefail

SOURCE=/opt/choicemee/source
ENV_FILE=/opt/choicemee/shared/backend.env
WEB=/var/www/choicemee/app
STAGE=$(realpath "${1:?Pass the reviewed release directory}")
case "$STAGE" in /opt/choicemee/review-*|/opt/choicemee/releases/*) ;; *) echo 'Invalid release directory'; exit 1 ;; esac
test -f "$STAGE/backend/dist/app.js"
test -f "$STAGE/client/dist/index.html"
test -s "$ENV_FILE"
test "$(id -u)" -eq 0
NGINX=$(readlink -f /etc/nginx/sites-enabled/choicemee.conf)
case "$NGINX" in /etc/nginx/sites-available/choicemee.conf) ;; *) echo 'Unexpected ChoiceMee Nginx target'; exit 1 ;; esac
grep -q 'proxy_pass http://127.0.0.1:5012;' "$NGINX"
! pm2 describe choicemee-candidate >/dev/null 2>&1
curl -fsS --max-time 15 http://127.0.0.1:5012/health >/dev/null

BACKUP=/opt/choicemee/backups/release-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -a "$SOURCE/apps/backend/dist" "$BACKUP/backend-dist"
cp -a "$WEB" "$BACKUP/app"
cp -a "$NGINX" "$BACKUP/nginx.conf"
cp -a "$ENV_FILE" "$BACKUP/backend.env"
ENV_HASH=$(sha256sum "$ENV_FILE" | cut -d' ' -f1)

set -a
. "$ENV_FILE"
set +a
export NODE_ENV=production
export CHOICEMEE_STAGED_BACKEND="$STAGE/backend"
export PORT=5013
ln -sfn "$SOURCE/apps/backend/node_modules" "$STAGE/backend/node_modules"

wait_health() {
  local port=$1
  for attempt in $(seq 1 40); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$port/health" >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

MAIN_CHANGED=false
ROUTED=false
rollback() {
  trap - ERR
  echo "Release failed. Restoring from $BACKUP"
  if [ "$MAIN_CHANGED" = true ]; then
    rsync -a --delete "$BACKUP/backend-dist/" "$SOURCE/apps/backend/dist/"
    pm2 restart choicemee-api
    if ! wait_health 5012; then echo 'Original API could not restart; candidate route retained for recovery'; exit 1; fi
  fi
  if [ "$ROUTED" = true ]; then install -m 644 "$BACKUP/nginx.conf" "$NGINX"; nginx -t && nginx -s reload; fi
  rsync -a "$BACKUP/app/" "$WEB/"
  pm2 delete choicemee-candidate >/dev/null 2>&1 || true
  exit 1
}
trap rollback ERR

# Additive columns only; current application and database relay continue running.
cd "$STAGE/backend"
node -e "const {ensureLabelNoteColumns}=require('./dist/models/migrations/ensureLabelNoteColumns');const {pool}=require('./dist/models/client');ensureLabelNoteColumns().then(()=>{pool.end();setTimeout(()=>process.exit(0),250)}).catch(e=>{console.error(e);process.exit(1)})"
pm2 start "$SOURCE/scripts/deploy/candidate-api.cjs" --name choicemee-candidate --time --kill-timeout 240000
wait_health 5013

# An authenticated read check must pass against the candidate before routing traffic.
BASE_URL=http://127.0.0.1:5013 node "$SOURCE/scripts/ops/verify-shipping-release.cjs"

sed 's#proxy_pass http://127.0.0.1:5012;#proxy_pass http://127.0.0.1:5013;#' "$BACKUP/nginx.conf" > "$BACKUP/nginx-candidate.conf"
install -m 644 "$BACKUP/nginx-candidate.conf" "$NGINX"
ROUTED=true
nginx -t
nginx -s reload
curl -fsS --max-time 15 https://api.choicemee.in/health >/dev/null

# Let in-flight requests on the previous upstream finish before restarting it.
for attempt in $(seq 1 120); do
  if ! ss -Htn state established '( sport = :5012 )' | grep -q .; then break; fi
  sleep 2
done
if ss -Htn state established '( sport = :5012 )' | grep -q .; then
  echo 'Previous API still has active requests; postponing release'
  false
fi

MAIN_CHANGED=true
rsync -a --delete "$STAGE/backend/dist/" "$SOURCE/apps/backend/dist/"
# Keep the saved PM2 runtime environment, including the working database relay URL.
pm2 restart choicemee-api
wait_health 5012
BASE_URL=http://127.0.0.1:5012 node "$SOURCE/scripts/ops/verify-shipping-release.cjs"
install -m 644 "$BACKUP/nginx.conf" "$NGINX"
nginx -t
nginx -s reload
ROUTED=false

# Retain previous hashed chunks for users who already have the app open.
rsync -a --exclude=index.html "$STAGE/client/dist/" "$WEB/"
install -m 644 "$STAGE/client/dist/index.html" "$WEB/index.next.html"
mv "$WEB/index.next.html" "$WEB/index.html"
test "$(sha256sum "$ENV_FILE" | cut -d' ' -f1)" = "$ENV_HASH"
for url in https://choicemee.in https://app.choicemee.in https://admin.choicemee.in https://api.choicemee.in/health; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url")
  echo "$url $code"
  test "$code" = 200
done
pm2 delete choicemee-candidate
pm2 save
trap - ERR
echo "DEPLOY_OK backup=$BACKUP"
