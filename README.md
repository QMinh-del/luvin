# Luvin

Private GitHub repository. Do not commit credentials, `.env` files, keystores, or other secrets. Use `.env.example` as a template only.

## Pinned tool versions

| Tool    | Version |
| ------- | ------- |
| Node.js | 24.21.0 |
| npm     | 11.19.0 |
| Java    | 21      |
| Flutter | 3.47.5  |
| Dart    | 3.13.4  |

Mobile fallback locale: `en` (`LUVIN_FALLBACK_LOCALE` in `.env.example`).

Android package ID: `com.luvin.app`.

## Android signing

Debug APKs use the standard local debug key. A release build never falls back
to that key: it requires `apps/mobile/android/key.properties`, which is ignored
by Git. Copy `apps/mobile/android/key.properties.example`, generate or obtain a
private Android upload keystore outside this repository, and fill in its local
path and passwords. Never commit the keystore or `key.properties`.

Firebase's Android configuration is also machine/environment local:
`apps/mobile/android/app/google-services.json` is ignored and must be supplied
through the approved private setup process. Never commit it.

## Folder ownership

| Path                      | GitHub team |
| ------------------------- | ----------- |
| Repository default (`*`)  | `@kendayyy` |
| `/apps/api/`              | `@kendayyy` |
| `/apps/mobile/`           | `@kendayyy` |
| `/packages/shared-types/` | `@kendayyy` |
| `/infrastructure/`        | `@kendayyy` |

See [`CODEOWNERS`](CODEOWNERS) for the authoritative mapping. Ownership may be
split into organization teams later without changing application behavior.

## Roles and branching

- **Maintainer** — merge root tooling and repository-wide changes.
- **Reviewer** — approve pull requests in owned areas.
- **Contributor** — open pull requests; no direct merges to protected branches.

Default branch: `main`. Once the remote exists, `main` requires pull requests; direct pushes are not allowed. TASK-B01 does not create the GitHub remote.

## Workspace commands

From the repository root:

```text
cd D:\Luvin\code
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run mobile:analyze
npm run mobile:test
npm run mobile:build
```

Makefile equivalents: `make install`, `make lint`, `make format-check`, `make typecheck`, `make test`, `make build`, `make mobile-analyze`, `make mobile-test`, `make mobile-build`.

## Database and local services

The MVP schema lives in `apps/api/prisma/schema.prisma`. Apply and seed against a running Postgres:

```text
npm run infra:test:up
$env:DATABASE_URL="postgresql://luvin:luvin@127.0.0.1:5433/luvin_test?schema=public"
npm run prisma:migrate
npm run prisma:seed
npm run infra:verify
```

Seed data is synthetic (`@example.test`) and contains no real personal information.

Pinned local images: PostgreSQL 16.15 (`postgres:16-alpine` digest `3c5c8892…`), Redis 7.4 (`redis:7.4-alpine` digest `520775a4…`), MinIO and `mc` from `quay.io` (digests in `infrastructure/docker/compose.yaml`). Docker Hub `minio/mc` is not used because pulls are denied.

```text
npm run infra:up
npm run infra:down
npm run infra:test:up
npm run infra:test:down
```

Development data uses persistent volumes and database `luvin_local`. Test data uses tmpfs, port offsets, database `luvin_test`, and `luvin-test-*` buckets. All published infrastructure ports bind to `127.0.0.1`, not the LAN. See `infrastructure/docker/README.md`.

Copy `.env.example` to `.env` locally. Do not commit `.env`.

Prepare all local dependencies, apply database migrations, and seed synthetic data:

```text
npm run local:prepare
```

Then start the API with the root `.env` loaded by Node:

```text
npm run api:start:local
```

Verify each stack independently. The checks use fixed synthetic local or test
service settings so inherited shell variables cannot cross the isolation
boundary. Keep service URLs and bucket names in a private `.env` aligned with
the selected `LUVIN_ENV` or application startup fails closed:

```text
npm run infra:up
npm run infra:verify:local
npm run infra:down

npm run infra:test:up
npm run infra:verify
npm run infra:test:down
```

## Botkeep

The API process is one NestJS server. REST and the WebSocket share it. Botkeep does not run Google Cloud Storage, so avatars and exports use a private directory on Botkeep's persistent disk and short-lived signed URLs served by the API.

In the Botkeep panel:

- Runtime: Node.js 24
- Project root: the repository root, where `package.json` and `package-lock.json` are
- Start command: `npm start`
- HTTP: the process listens on `0.0.0.0` and `SERVER_PORT`
- Slots: this API, plus one PostgreSQL and one Redis. Point both connection strings at those slots.

Environment values belong in the panel, not in git:

```text
NPM_CONFIG_PRODUCTION=false
NODE_ENV=production
LUVIN_ENV=production
OBJECT_STORAGE_BACKEND=filesystem
OBJECT_STORAGE_ROOT=/app/data/objects
PUBLIC_BASE_URL=https://your-domain
DATABASE_URL=postgresql://...
DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----...
REDIS_URL=rediss://...
REDIS_SSL_CA=-----BEGIN CERTIFICATE-----...
ACCESS_TOKEN_SECRET=at-least-32-characters
PASSWORD_RECOVERY_ENABLED=false
```

`npm start` builds the API, applies Prisma migrations, then stays on the server process. A restart receives `SIGTERM` and closes Redis and PostgreSQL. Leave `GOOGLE_CLOUD_PROJECT` unset when object storage is `filesystem`. Password recovery stays off until a verified Resend domain exists. Do not seed real accounts from this command.

Local MinIO and the Google Cloud topology are unchanged. `npm run api:start:local` is still the local API.

## Configuration and health

Startup validates `LUVIN_ENV` and required variables. Invalid configuration exits before the HTTP server listens and does not print secret values.

- `GET /v1/health/live` — process liveness
- `GET /v1/health/ready` — PostgreSQL, Redis, and local object-storage readiness (`503` when a required check is down)

Logs are JSON with a request ID from `X-Request-ID` when it matches the allowed pattern. Passwords, tokens, keys, signed URLs, message text, coordinates, date of birth, report text, and moderation evidence are redacted.

Transactional email uses Resend sandbox credentials only in `local`, `test`, and `development`. Production password recovery stays disabled until `TASK-A08` verifies a sender domain. Google Cloud alert and uptime configuration lives in `infrastructure/gcp/`. `npm run observability:apply` exits without changing cloud resources when `GOOGLE_CLOUD_PROJECT` is missing.

Production topology is defined in `infrastructure/gcp/topology.md`. Region benchmarks are not done. `npm run gcp:provision` stays blocked while the published-price floor exceeds the USD 50 monthly cap.

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs on pull requests and pushes to `main`. Each job name identifies the application and command. The workflow grants `contents: read`. npm and Flutter caches are keyed from lockfiles and receive no production secrets. The `ci` environment exists for future protected secrets and currently stores none.

The Prisma job applies every migration to an empty PostgreSQL 16 database, then checks migration status.

Local equivalents:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run infra:test:up
npm run infra:verify
npm run mobile:analyze
npm run mobile:test
npm audit --audit-level=critical
```

Required status checks before merge, once repository rules are available: Backend lint, typecheck, and tests; Prisma migration validation; API local-infrastructure integration tests; Flutter analyze and tests; Secret scan; Dependency audit.

Owner decision 2026-09-27, option B: `https://github.com/kendayyy/luvin` is public so GitHub Free can enforce required checks. Active ruleset `24047600` blocks updates to `main` unless these checks pass: Backend lint, typecheck, and tests; Prisma schema validation; API local-infrastructure integration tests; Flutter analyze and tests; Secret scan; Dependency audit. There are no bypass actors. The published workflow still names the Prisma job `Prisma schema validation`.

Pinned Flutter/Dart (`3.47.5` / `3.13.4`) does not include `dart pub audit`. Dependency audit in CI is `npm audit --audit-level=critical` plus a remaining-findings report. Residual high/moderate npm findings are not merge blockers in this task.

## Product scope (TASK-B01)

Chat is not implemented. Do not describe the product as end-to-end encrypted (E2EE). MVP chat, when added later, is server-readable per project contracts.
