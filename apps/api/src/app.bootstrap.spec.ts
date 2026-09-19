import assert from "node:assert/strict";
import test from "node:test";
import { Test } from "@nestjs/testing";
import { LUVIN_CONTRACT_VERSION } from "@luvin/shared-types";
import { AppModule } from "./app.module";

test("shared types are reachable from the API", () => {
  assert.equal(LUVIN_CONTRACT_VERSION, "0.0.0");
});

test("Nest application boots AppModule", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  assert.ok(app);
  await app.close();
});
