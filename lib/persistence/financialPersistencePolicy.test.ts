import assert from "node:assert/strict";
import test from "node:test";
import { resolvePersistenceWriteTarget } from "./financialPersistencePolicy";

test("writes locally only before the remote backend has ever been activated", () => {
  assert.equal(
    resolvePersistenceWriteTarget({
      remoteActive: false,
      remoteWasActivated: false,
    }),
    "local",
  );
  assert.equal(
    resolvePersistenceWriteTarget({
      remoteActive: true,
      remoteWasActivated: true,
    }),
    "remote",
  );
  assert.equal(
    resolvePersistenceWriteTarget({
      remoteActive: false,
      remoteWasActivated: true,
    }),
    "none",
  );
});
