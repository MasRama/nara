# Deployment

A Nara application in production is one Node process and one SQLite file. The
process serves the built Vue app and the API over plain HTTP; a reverse proxy
in front of it holds the TLS certificate. The application itself has no
certificate or HTTPS setting.

This guide deploys to a single Linux host with Caddy as the proxy. An nginx
equivalent is at the end.

## Build and configure

```bash
git clone https://github.com/you/your-app.git
cd your-app
npm ci
cp .env.production.example .env.production
npm run build
```

Set these in `.env.production`:

```bash
NODE_ENV=production
PORT=5555
APP_URL=https://app.example.com

HOST=127.0.0.1
TRUST_PROXY=true
TRUST_PROXY_HOPS=1
```

- `APP_URL` is the public address visitors type, with `https://`.
- `HOST=127.0.0.1` makes the application listen on loopback only. Left unset
  it listens on every address of the machine, and anyone who reaches the port
  directly bypasses the proxy.
- `TRUST_PROXY=true` tells the application to take the visitor's address from
  the `X-Forwarded-For` header the proxy writes. Without it every request
  appears to come from the proxy, so **all visitors share one rate limit and
  one sign-in lockout**: a busy site answers `429` to everyone, and a few
  wrong passwords lock every account's sign-in. The application logs a warning
  the first time it sees a forwarded request while this is off.
- Only set `TRUST_PROXY=true` together with `HOST=127.0.0.1` (or a firewall
  that closes the port). A client that can reach the port directly can write
  the header itself and choose its own address.
- `TRUST_PROXY_HOPS` is the number of proxies between the visitor and the
  application: `1` for Caddy alone.

Create the first administrator with a password of your own, never the
development default:

```bash
NARA_ADMIN_NAME='Your Name' NARA_ADMIN_EMAIL='you@example.com' \
  NARA_ADMIN_PASSWORD='a-long-password' npm run setup
```

## Run

```bash
npm start
```

Startup applies pending migrations before it listens. Keep the process running
with the supervisor you already use. With pm2:

```bash
pm2 start build/server.js --name your-app --time
pm2 save
```

Run it from the project directory: the application reads `.env.production`,
and writes `database/`, `storage/` and `logs/`, relative to where it starts.

`GET /health` answers once the process is up, and `GET /ready` once the
database is migrated; use them for uptime checks.

## Caddy

```caddyfile
app.example.com {
	reverse_proxy 127.0.0.1:5555
}
```

That is the whole configuration. Caddy obtains and renews the certificate,
redirects HTTP to HTTPS, writes `X-Forwarded-For` with the visitor's address
(it discards a value the visitor sent), and passes the live-update stream at
`/api/events` through without buffering.

If another proxy or CDN sits in front of Caddy, list its addresses in Caddy's
`trusted_proxies` so Caddy keeps the visitor's address in the header, and set
`TRUST_PROXY_HOPS=2`.

## Backups

In production the application backs its database up every 24 hours into
`database/backups/` and keeps the newest 7. Those files are on the same disk
as the database, so also copy the directory to another machine, for example
from cron:

```bash
rsync -a /home/you/your-app/database/backups/ backup-host:your-app-backups/
```

Uploaded files live in `storage/` and are not part of the database backup;
copy that directory the same way. Settings, the restore procedure and manual
backups are in [`database-lifecycle.md`](./database-lifecycle.md#backup-and-integrity).

## Update

```bash
git pull
npm ci
npm run build
pm2 restart your-app
```

The restart applies new migrations. For a release with migrations, take a
backup first with `npm run db:backup`: migrations only go forward, and a
backup is the way back.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    # ssl_certificate and ssl_certificate_key as issued for the domain

    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

`X-Forwarded-For $remote_addr` replaces whatever the visitor sent, which is
what `TRUST_PROXY_HOPS=1` expects. The live-update stream asks nginx not to
buffer it (`X-Accel-Buffering: no`), and `proxy_read_timeout` must stay above
its 25-second heartbeat.
