/**
 * Fail closed: never provision Google Cloud when the topology gate is closed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(readFileSync(join(root, "topology.json"), "utf8"));

const project =
  process.env.LUVIN_GCP_PROJECT_PRODUCTION?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim();

const blockers = [];
if (!project) {
  blockers.push("missing_project_id");
}
if (!topology.productionRegion) {
  blockers.push("region_not_selected");
}
if (topology.estimate?.provisioningBlocked) {
  blockers.push("budget_cap_exceeded");
}

if (blockers.length > 0) {
  process.stderr.write(
    `${JSON.stringify({
      severity: "ERROR",
      event: "gcp.provision.blocked",
      blockers,
    })}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({
      severity: "INFO",
      event: "gcp.provision.ready",
      note: "Owner apply only. This script does not mutate cloud resources.",
    })}\n`,
  );
}
