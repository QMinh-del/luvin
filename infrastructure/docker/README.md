# Local Docker

Pinned images (see compose files for digests): PostgreSQL 16.15 Alpine, Redis 7.4 Alpine, MinIO and `mc` from Quay.

```text
npm run infra:up
```

Stop:

```text
npm run infra:down
```

Isolated test data (different ports, tmpfs, `luvin_test` database, `luvin-test-*` buckets):

```text
npm run infra:test:up
npm run infra:test:down
```

Synthetic local credentials are documented in `.env.example`. Do not commit real secrets.

MinIO buckets are created privately (`anonymous none`):

- local: `luvin-local-avatars`, `luvin-local-exports`
- test: `luvin-test-avatars`, `luvin-test-exports`

Makefile: `make infra-up`, `make infra-down`, `make infra-test-up`, `make infra-test-down`.
