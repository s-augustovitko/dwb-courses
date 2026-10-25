# dwb-courses

## Summary

Course registration and admin CRM for DWB: public registration forms with Culqi payments, and an admin dashboard for forms, registrations and payments.

- **API:** Go + Fiber, SQLite (WAL), sqlc
- **Web:** SolidJS SPA + Bulma, built with Vite and Bun
- **Runtime:** Podman containers behind Caddy, with Litestream replicating the database to S3

## Development Run

Requires Podman, Make, Go, Bun and uv.

```sh
cp .env.example .local.env    # fill in Zoho and Culqi values
make tools              # goose, sqlc, golangci-lint, ansible
make deps               # go mod tidy, sqlc generate, bun i
make migrate_up         # creates local/db_data/main.db
make run                # starts the local stack
```

- App: https://web.localhost:3000
- Logs (Dozzle): https://dozzle.localhost:3000

Other targets: `make lint`, `make help`, `make logs SERVICE=<name>`, `make clean`.

## Deployments

Deploys run from your machine: images are built locally, copied over SSH and started with Ansible. `DEPLOY_ENV` is `stage` (default) or `prod`.

Needs `.<env>.env` (from `.env.example`) and `.deploy.<env>.env` (from `.deploy.env.example`).

```sh
make host_first                  # once per new server
make deploy                      # stage
make deploy DEPLOY_ENV=prod      # prod
make rollback                    # previous images
make db_restore                  # database from the replica (optional TIMESTAMP=...)
```

## Configuration

| What | Where |
|---|---|
| App settings (hosts, CORS, timeouts, email, rate limits) | `config/<env>.yaml` (all keys in `config/example.yaml`) |
| App secrets (Zoho, Culqi) | `.<env>.env` (`.local.env`, `.stage.env`, `.prod.env`) |
| Server access, backups bucket, Dozzle login | `.deploy.<env>.env` |
| Server sizing, monitor host, Litestream on/off | `infra/ansible/host_vars/<env>.yml` |

Env vars override the YAML. The `.env` files are not in git, so keep them in a password manager.

## Recovery

| Problem | What to do |
|---|---|
| Bad deploy | Rolls back by itself if the API is unhealthy; otherwise `make rollback` |
| Bad or deleted data | `make db_restore TIMESTAMP=2026-10-18T09:00:00Z` (7 days of history) |
| Server lost | New server, update `DEPLOY_HOST`, `make host_first`, `make deploy` (the database restores from the replica) |
| Check the backup | `make db_verify` |

The backup commands (`db_verify`, `db_restore`) need Litestream on. Stage has it off, so it has no backups.

## Infra

```
cmd/                 API entry point
internal/            API packages (one per domain)
web/                 SolidJS SPA
config/              App config per environment (local, stage, prod)
infra/
  migrations/        goose migrations
  queries/           sqlc queries
  Dockerfile         API image
  Dockerfile.web     Caddy image with the built SPA
  config/            Caddyfile and litestream.yml for the server
  systemd/           Podman Quadlet units (api, caddy, litestream, migrate, dozzle)
  ansible/           Playbooks: host setup, deploy, rollback, backups
local/               Local compose stack, Caddyfile and data
deploy.mk            Deployment make targets
```

On the server, Caddy serves the SPA and proxies `/api/v1` to the API. The API uses `/data/main.db`. Where Litestream is on, it streams the database to an S3 bucket, and on start a missing database is restored from the replica. Migrations then run.
