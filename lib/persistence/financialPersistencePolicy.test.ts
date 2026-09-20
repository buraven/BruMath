import assert from "node:assert/strict";
import test from "node:test";
import {
  resolvePersistenceWriteTarget,
  type FinancialPersistenceStatus,
} from "./financialPersistencePolicy";

function target(
  overrides: Partial<Parameters<typeof resolvePersistenceWriteTarget>[0]> = {},
) {
  return resolvePersistenceWriteTarget({
    hasHydrated: true,
    supabaseConfigured: false,
    status: "local" as FinancialPersistenceStatus,
    remoteActive: false,
    remoteWasActivated: false,
    ...overrides,
  });
}

test("persists hydrated local snapshots, including profile changes", () => {
  assert.equal(target(), "local");
  assert.equal(target({ status: "local", remoteActive: false }), "local");
});

test("routes an active remote backend exclusively to the remote queue", () => {
  assert.equal(
    target({
      supabaseConfigured: true,
      status: "remote",
      remoteActive: true,
      remoteWasActivated: true,
    }),
    "remote",
  );
});

test("never falls back to local storage while Supabase is configured", () => {
  for (const status of [
    "loading",
    "auth-required",
    "migration-required",
    "remote-error",
  ] as const) {
    assert.equal(
      target({
        supabaseConfigured: true,
        status,
        remoteActive: false,
        remoteWasActivated: status === "remote-error",
      }),
      "none",
    );
  }
});

test("does not write before hydration", () => {
  assert.equal(
    target({
      hasHydrated: false,
      remoteActive: false,
      remoteWasActivated: true,
    }),
    "none",
  );
});
