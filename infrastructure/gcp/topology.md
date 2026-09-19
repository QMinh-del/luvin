# Google Cloud production topology (TASK-B05)

Status: **Defined, not provisioned.** Production region is **not selected**. Provisioning is **blocked** because the published-price floor exceeds the approved monthly cap of USD 50.

## Locked targets this topology must serve

| Item                         | Value                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| Planning load                | 10,000 registered users, 1,000 DAU, 500 concurrent devices |
| API load                     | 100 rps for 15 minutes; 250 rps for 60 seconds             |
| Feature load                 | 50 location updates/s and 25 chat messages/s with fanout   |
| Ordinary API latency         | p95 ≤ 500 ms, p99 ≤ 1,500 ms                               |
| Auth API latency             | p95 ≤ 1,000 ms, p99 ≤ 2,000 ms including Argon2id          |
| In-region WebSocket delivery | p95 ≤ 1,000 ms, p99 ≤ 3,000 ms                             |
| Revocation                   | p95 ≤ 2 s, hard max 5 s                                    |
| Availability                 | 99.5 percent per calendar month                            |
| Durable RPO / RTO            | ≤ 24 hours / ≤ 4 hours                                     |
| Backup retention             | 30 days                                                    |
| Budget                       | < USD 50 / month                                           |

## Services

Separate Google Cloud projects: development, staging, production. No shared production database, Redis, or bucket with lower environments.

| Workload                        | Service                                                           | Exposure                                                                           |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| NestJS REST                     | Cloud Run service `luvin-api`                                     | Public HTTPS only via Cloud Run ingress or HTTPS load balancer; no public database |
| NestJS WebSocket `/v1/realtime` | Cloud Run service `luvin-realtime` (same image, separate service) | Public HTTPS/WSS; no session affinity requirement                                  |
| PostgreSQL                      | Cloud SQL for PostgreSQL 16, private IP                           | Private; authorized Cloud Run connector / VPC only                                 |
| Redis fanout and presence       | Memorystore for Redis                                             | Private VPC; no public IP                                                          |
| Avatars                         | GCS bucket `*-avatars` uniform access, public prevention          | Private; signed URLs only                                                          |
| Exports                         | GCS bucket `*-exports`                                            | Private; signed URLs only                                                          |
| Secrets                         | Secret Manager per project                                        | Not in git, images, or workflow logs                                               |
| Identity to Google APIs         | Dedicated service accounts, least privilege                       | No user keys in source                                                             |

Local development remains Docker Compose PostgreSQL, Redis, and MinIO from TASK-B02.

## WebSocket on Cloud Run

Cloud Run can keep an HTTP/2 or WebSocket request up to the configured timeout (maximum 3600 seconds). That is not a durable session store.

- Do **not** rely on session affinity. Any instance may drop when the request ends, the revision is replaced, or the instance scales to zero.
- Fanout durable-enough for connected clients through Memorystore Pub/Sub or Redis pub/sub. Presence is transient; after reconnect, clients reconcile with authorized REST using `lastKnownEventId` from the WebSocket contract.
- Heartbeat (`system.ping.v1` / `system.pong.v1`) keeps the request alive within the timeout and detects dead sockets.
- Reconnect storm: 500 clients over 120 seconds must not grant unauthorized rooms. Authorization is re-checked on handshake, not cached from the previous instance.
- Sticky sessions are forbidden as an authorization mechanism.

## Networking and TLS

- Databases, Memorystore, and GCS stay private.
- Ingress: HTTPS only. HTTP redirects at the edge.
- DNS and public domain wait for TASK-A08.
- Firewall: Cloud SQL authorized networks empty; private IP plus Cloud SQL Auth Proxy or Direct VPC egress from Cloud Run.
- Service accounts: `luvin-api` runtime SA can connect to Cloud SQL, Memorystore, the two buckets, and Secret Manager in the same project only.

## Secrets

| Secret                      | Development          | Staging                     | Production                        |
| --------------------------- | -------------------- | --------------------------- | --------------------------------- |
| `DATABASE_URL`              | Secret Manager `dev` | Secret Manager `staging`    | Secret Manager `prod`             |
| `REDIS_URL`                 | same                 | same                        | same                              |
| `RESEND_SANDBOX_API_KEY`    | allowed              | forbidden                   | forbidden                         |
| `RESEND_PRODUCTION_API_KEY` | forbidden            | allowed if recovery enabled | allowed only with verified domain |

Never copy sandbox and production Resend keys into the same running process.

## Backups, RPO, RTO

- Cloud SQL automated backups daily, retain 30 days, PITR enabled if the instance tier supports it without breaking the budget gate (currently blocked).
- Restore runbook: `infrastructure/gcp/restore-runbook.md`.
- Restore is **not yet executed**. TASK-B05 does not claim a tested RTO.
- Redis is not backed up. Clients sync durable state from PostgreSQL after recovery.

## Availability SLIs

Monthly availability = successful external `GET /v1/health/ready` probes plus server-side 2xx/3xx ratio on Cloud Run, excluding owner-approved maintenance windows recorded in the operations log.

- External uptime check: 60s period against `/v1/health/ready` (artifact from TASK-B04).
- Error budget for 99.5 percent ≈ 3.6 hours/month.
- Alert when ready-check fails for 60s or 5xx rate is elevated (TASK-B04 policies).

## Autoscaling

- Cloud Run: min instances 0 until a measured load test proves cold-start cannot meet latency. Max instances sized after benchmarks.
- Cloud SQL and Memorystore: single-region, no HA replica until budget is raised.

## Infrastructure as code and deploy flow

- Foundation: `infrastructure/gcp/terraform/`
- Apply is fail-closed: `npm run gcp:provision` requires project IDs and still refuses when `topology.json` has `provisioningBlocked: true`
- GitHub Actions production deploy remains a later task; this task does not add a production deploy workflow
- CODEOWNERS: `/infrastructure/` stays `@luvin/infrastructure-maintainers`

## Region benchmarks

Candidate regions: Singapore `asia-southeast1`, Taiwan `asia-east1`, Tokyo `asia-northeast1`.

No latency or regional cost benchmark was executed. Selecting a region now would violate the locked engineering parameter. Vietnam launch latency should be measured from Vietnam and from each candidate region after an owner-funded project exists.

## Cost gate

See `infrastructure/gcp/topology.json` and `infrastructure/gcp/cost-estimate.md`.

The published-price floor for Memorystore (1 GiB Basic) plus a lower-bound Cloud SQL instance plus minimal Cloud Run is **above USD 50**. Provisioning is blocked. Owner must choose a higher budget, a formally changed topology, or a formally changed load target. This task does not weaken Memorystore, Cloud SQL, Cloud Run, privacy, or latency targets.
