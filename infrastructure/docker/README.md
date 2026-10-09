# Local Docker

Pinned images (see compose files for digests): PostgreSQL 16.15 Alpine, Redis 7.4 Alpine, MinIO and `mc` from Quay.

The npm commands support Docker Compose V2 (`docker compose`, preferred) and legacy Docker Compose V1 (`docker-compose`). The files use the current Compose Specification and no floating `latest` images. The wrapper preserves V2 health waiting and provides an equivalent container-health wait for V1. Every published database, cache, API-storage, and MinIO-console port binds to `127.0.0.1` so the synthetic credentials are not exposed to the local network.

```text
npm run infra:up
npm run infra:verify:local
```

Stop:

```text
npm run infra:down
```

Isolated test data (different ports, tmpfs, `luvin_test` database, `luvin-test-*` buckets):

```text
npm run infra:test:up
npm run infra:verify
npm run infra:test:down
```

Synthetic local credentials are documented in `.env.example`. Do not commit real secrets.

MinIO buckets are created idempotently and privately (`anonymous none`):

- local: `luvin-local-avatars`, `luvin-local-exports`
- test: `luvin-test-avatars`, `luvin-test-exports`

Makefile: `make infra-up`, `make infra-down`, `make infra-test-up`, `make infra-test-down`.
