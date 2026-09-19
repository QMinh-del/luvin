import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const topology = JSON.parse(readFileSync(join(dir, "topology.json"), "utf8"));

test("does not select a production region before benchmarks", () => {
  assert.equal(topology.productionRegion, null);
  assert.equal(topology.candidateRegions.length, 3);
});

test("blocks provisioning when the published-price floor exceeds the cap", () => {
  assert.equal(topology.estimate.exceedsApprovedCap, true);
  assert.equal(topology.estimate.provisioningBlocked, true);
  assert.ok(topology.estimate.subtotalUsd > topology.budgetCapUsd);
});

test("provision script fails closed without mutating cloud", () => {
  const result = spawnSync(process.execPath, [join(dir, "provision.mjs")], {
    env: { ...process.env, GOOGLE_CLOUD_PROJECT: "", LUVIN_GCP_PROJECT_PRODUCTION: "" },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gcp.provision.blocked/);
});
