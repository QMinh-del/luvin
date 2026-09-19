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

## Folder ownership

| Path                      | GitHub team                         |
| ------------------------- | ----------------------------------- |
| Repository default (`*`)  | `@luvin/maintainers`                |
| `/apps/api/`              | `@luvin/backend-maintainers`        |
| `/apps/mobile/`           | `@luvin/mobile-maintainers`         |
| `/packages/shared-types/` | `@luvin/contract-maintainers`       |
| `/infrastructure/`        | `@luvin/infrastructure-maintainers` |

See [`CODEOWNERS`](CODEOWNERS) for the authoritative mapping. Replace placeholder team handles before enabling branch protection on the private remote.

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

Prisma is initialized without product tables. Migrations arrive in TASK-C01.

Pinned local images: PostgreSQL 16.15 (`postgres:16-alpine` digest `3c5c8892…`), Redis 7.4 (`redis:7.4-alpine` digest `520775a4…`), MinIO and `mc` from `quay.io` (digests in `infrastructure/docker/compose.yaml`). Docker Hub `minio/mc` is not used because pulls are denied.

```text
npm run infra:up
npm run infra:down
npm run infra:test:up
npm run infra:test:down
```

Development data uses persistent volumes and database `luvin_local`. Test data uses tmpfs, port offsets, database `luvin_test`, and `luvin-test-*` buckets. See `infrastructure/docker/README.md`.

Copy `.env.example` to `.env` locally. Do not commit `.env`.

## Configuration and health

Startup validates `LUVIN_ENV` and required variables. Invalid configuration exits before the HTTP server listens and does not print secret values.

- `GET /v1/health/live` — process liveness
- `GET /v1/health/ready` — PostgreSQL, Redis, and local object-storage readiness (`503` when a required check is down)

Logs are JSON with a request ID from `X-Request-ID` when it matches the allowed pattern. Passwords, tokens, keys, signed URLs, message text, coordinates, date of birth, report text, and moderation evidence are redacted.

Transactional email uses Resend sandbox credentials only in `local`, `test`, and `development`. Production password recovery stays disabled until `TASK-A08` verifies a sender domain. Google Cloud alert and uptime configuration lives in `infrastructure/gcp/`. `npm run observability:apply` exits without changing cloud resources when `GOOGLE_CLOUD_PROJECT` is missing.

Production topology is defined in `infrastructure/gcp/topology.md`. Region benchmarks are not done. `npm run gcp:provision` stays blocked while the published-price floor exceeds the USD 50 monthly cap.

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs on pull requests and pushes to `main`. Jobs are named by application and command. The workflow uses `contents: read` and the protected `ci` environment. Do not store long-lived production credentials in Actions.

Local equivalents:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npx prisma validate --schema apps/api/prisma/schema.prisma
# Prisma validate requires DATABASE_URL in the environment. Use a non-secret placeholder; it does not connect.
npm run mobile:analyze
npm run mobile:test
npm audit --audit-level=critical
```

Require these status checks on `main` before merge: Backend lint, typecheck, and tests; Prisma schema validation; API local-infrastructure integration tests; Flutter analyze and tests; Secret scan; Dependency audit.

Pinned Flutter/Dart (`3.47.5` / `3.13.4`) does not include `dart pub audit`. Dependency audit in CI is `npm audit --audit-level=critical` plus a remaining-findings report. Residual high/moderate npm findings are not treated as merge blockers in this task.

## Product scope (TASK-B01)

Chat is not implemented. Do not describe the product as end-to-end encrypted (E2EE). MVP chat, when added later, is server-readable per project contracts.
