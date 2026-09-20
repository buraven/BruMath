import assert from "node:assert/strict";
import test from "node:test";
import { createSignOutConfirmation } from "./createSignOutConfirmation";

test("reuses the supplied persistence signOut flow", async () => {
  let calls = 0;
  const confirmation = createSignOutConfirmation(async () => {
    calls += 1;
  });

  confirmation.onConfirm();
  await Promise.resolve();

  assert.equal(confirmation.title, "Sair do BruMath");
  assert.equal(calls, 1);
});
