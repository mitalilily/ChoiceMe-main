# ChoiceMee VPS Deploy

This repo deploys to isolated VPS paths only:

- Source sync: `/opt/choicemee/source`
- Shared backend env: `/opt/choicemee/shared/backend.env`
- Static sites: `/var/www/choicemee/landing`, `/var/www/choicemee/app`, `/var/www/choicemee/admin`
- PM2 process: `choicemee-api`
- Proxy config: `/etc/nginx/sites-available/choicemee.conf` or `/etc/caddy/conf.d/choicemee.caddy`
- Optional pgAdmin container: `choicemee-pgadmin`

Required GitHub Actions secrets:

- `VPS_HOST`: `72.60.96.97`
- `VPS_USER`: `root`
- `VPS_SSH_KEY` preferred, or `VPS_PASSWORD`
- `BACKEND_ENV_B64`: base64-encoded backend `.env` content

Optional secrets:

- `PGADMIN_PASSWORD`
- `PGADMIN_EMAIL`

When `PGADMIN_PASSWORD` is set and Docker is available on the VPS, the deploy script starts an isolated pgAdmin container on `127.0.0.1:5050` and preloads the ChoiceMee Postgres server from `DATABASE_URL`.

Domain targets:

- Landing: `https://choicemee.in`
- Client app: `https://app.choicemee.in`
- Admin: `https://admin.choicemee.in`
- API: `https://api.choicemee.in`
- pgAdmin: `https://pgadmin.choicemee.in`

`pgadmin.choicemee.in` needs its own DNS A record or wildcard DNS pointing to the VPS.
