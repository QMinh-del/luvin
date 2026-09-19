# Cloud SQL restore runbook

This procedure is written for a single-region MVP. It has **not been executed**. Do not mark RTO as proven until a timed restore drill succeeds.

## Objectives

- RPO at most 24 hours (daily backup plus logs if PITR is enabled)
- RTO at most 4 hours from declare-disaster to `/v1/health/ready` returning 200 in the replacement environment
- Redis is rebuilt empty; clients reconcile through authorized REST

## Preconditions

- Production project ID
- Cloud SQL instance with 30-day backup retention
- Operator using a break-glass role, not the runtime service account
- `GOOGLE_CLOUD_PROJECT` set; never paste connection strings into tickets or chat

## Steps (not yet timed)

1. Declare the incident and record the start timestamp in the operations log (no private payloads).
2. Identify the latest successful backup whose timestamp is within 24 hours.
3. Restore to a new private-IP instance in the same region (region still unset until benchmarks exist).
4. Update Secret Manager `DATABASE_URL` to the restored instance. Do not log the URL.
5. Restart Cloud Run `luvin-api` and `luvin-realtime` so they pick up the new secret.
6. Confirm `GET /v1/health/ready` is 200.
7. Confirm Memorystore is reachable; accept empty presence.
8. Record end timestamp. If elapsed time exceeds 4 hours, the drill failed.

## Blocker

Restore cannot be tested until Google Cloud projects and billing exist and the budget gate is resolved.
