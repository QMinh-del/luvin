/**
 * Fail closed: do not apply Google Cloud observability without an explicit project.
 * This script does not create billing resources. It only prints the files that
 * an owner may apply after GOOGLE_CLOUD_PROJECT is set.
 */
const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();

if (!project) {
  process.stderr.write(
    `${JSON.stringify({
      severity: "ERROR",
      event: "observability.apply.blocked",
      message:
        "GOOGLE_CLOUD_PROJECT is required before applying observability configuration",
    })}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({
      severity: "INFO",
      event: "observability.apply.ready",
      googleCloudProject: project,
      files: [
        "infrastructure/gcp/observability.yaml",
        "infrastructure/gcp/alerting-health-ready.yaml",
        "infrastructure/gcp/alerting-backend-5xx.yaml",
      ],
      note: "Owner must apply these files with organization gcloud credentials. This script does not mutate cloud resources.",
    })}\n`,
  );
}
