# Cost estimate (TASK-B05)

Currency: USD. Cap: less than 50 per calendar month.

Sources retrieved 2026-09-19:

- [Memorystore for Redis pricing](https://cloud.google.com/memorystore/docs/redis/pricing) — Basic M1 (1–4 GiB) default **$0.049 per GiB-hour**
- [Cloud Run pricing](https://cloud.google.com/run/pricing) — Singapore (`asia-southeast1`) is listed on Google's Tier 2 table; Taiwan and Tokyo are on the other regional table. Exact CPU/memory unit prices were not re-quoted into this file as a fake invoice.
- [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator) — required for a binding quote after projects exist

## Floor that already threatens the cap

| Line                                           | Calculation                                                   | USD / month |
| ---------------------------------------------- | ------------------------------------------------------------- | ----------: |
| Memorystore Redis Basic 1 GiB                  | 0.049 × 730 hours                                             |       35.77 |
| Cloud SQL PostgreSQL shared-core + ~10 GB disk | US-list proxy used as a **lower bound**, not a regional quote |       10.00 |
| Cloud Run API + realtime, min instances 0      | placeholder until load is measured                            |        5.00 |
| **Subtotal**                                   |                                                               |   **50.77** |

Omitted and therefore understated: Cloud SQL backups, Memorystore regional deltas, egress from Vietnam users, Artifact Registry, Secret Manager, Logging ingest, uptime checks, a non-zero Cloud Run min-instance (needed if cold start misses p95), High Availability SQL, Standard-tier Redis.

`exceedsApprovedCap` is **true**. `provisioningBlocked` is **true**.

## What this is not

- Not a Singapore / Taiwan / Tokyo benchmark
- Not permission to provision
- Not a change to Argon2id, latency, RPO/RTO, or privacy rules
