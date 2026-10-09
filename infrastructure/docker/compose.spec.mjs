import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const localComposeUrl = new URL("./compose.yaml", import.meta.url);
const testComposeUrl = new URL("./compose.test.yaml", import.meta.url);

async function readComposeFiles() {
  return {
    local: await readFile(localComposeUrl, "utf8"),
    test: await readFile(testComposeUrl, "utf8"),
  };
}

test("local infrastructure ports are exposed only on loopback", async () => {
  const compose = await readComposeFiles();

  for (const port of ["5432", "6379", "9000", "9001"]) {
    assert.match(compose.local, new RegExp(`127\\.0\\.0\\.1:${port}:`));
  }
  for (const port of ["5433", "6380", "9100", "9101"]) {
    assert.match(compose.test, new RegExp(`127\\.0\\.0\\.1:${port}:`));
  }
});

test("MinIO bucket initialization is private and idempotent", async () => {
  const compose = await readComposeFiles();

  for (const content of [compose.local, compose.test]) {
    assert.match(content, /mc mb --ignore-existing luvin/);
    assert.doesNotMatch(content, /--ignore-existing -p/);
    assert.equal((content.match(/mc anonymous set none/g) ?? []).length, 2);
  }
});

test("development and test storage remain isolated", async () => {
  const compose = await readComposeFiles();

  assert.match(compose.local, /POSTGRES_DB: luvin_local/);
  assert.match(compose.local, /luvin-local-avatars/);
  assert.match(compose.local, /luvin-local-exports/);
  assert.match(compose.local, /luvin_pg_local:\/var\/lib\/postgresql\/data/);

  assert.match(compose.test, /POSTGRES_DB: luvin_test/);
  assert.match(compose.test, /luvin-test-avatars/);
  assert.match(compose.test, /luvin-test-exports/);
  assert.match(compose.test, /tmpfs:/);
  assert.doesNotMatch(compose.test, /luvin_pg_local/);
});

test("Compose files use the current specification without obsolete version keys", async () => {
  const compose = await readComposeFiles();

  assert.doesNotMatch(compose.local, /^version:/m);
  assert.doesNotMatch(compose.test, /^version:/m);
});
