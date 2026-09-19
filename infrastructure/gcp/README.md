# Google Cloud observability for the NestJS API

These files are configuration artifacts for TASK-B04. They are not applied to a live project until `GOOGLE_CLOUD_PROJECT` is provided and an owner applies them. Do not put API keys, tokens, or private user payloads in these files.

- Logs: Cloud Run stdout JSON (`severity`, `event`, `requestId`, `service`).
- Errors: JSON payloads include the Error Reporting `@type` when `GOOGLE_CLOUD_PROJECT` is set.
- Metrics/alerts: uptime against `GET /v1/health/ready` and 5xx rate on `luvin-api`.
- Log retention: use the Google Cloud project logging retention. This task does not invent a product retention period.
- Redaction: application logs omit passwords, tokens, keys, signed URLs, message text, coordinates, date of birth, report text, and moderation evidence.

Apply is fail-closed. From `D:\Luvin\code`:

```text
npm run observability:apply
```

That command exits without changing cloud resources when `GOOGLE_CLOUD_PROJECT` is missing.

## Production topology (TASK-B05)

See `infrastructure/gcp/topology.md` and `infrastructure/gcp/cost-estimate.md`. Region is not selected. `npm run gcp:provision` is fail-closed and currently blocked because the published-price floor exceeds the USD 50 monthly cap.

