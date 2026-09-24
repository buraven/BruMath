import assert from "node:assert/strict";
import test from "node:test";
import { RemoteSessionInitializationGate } from "./RemoteSessionInitializationGate";

test("initializes an authenticated session once when auth reports it twice", async () => {
  let starts = 0;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    release = resolve;
  });
  const gate = new RemoteSessionInitializationGate();
  const initialize = async () => {
    starts += 1;
    await started;
  };

  const first = gate.initialize("user-a", initialize);
  const second = gate.initialize("user-a", initialize);
  assert.equal(starts, 1);
  release();
  await Promise.all([first, second]);

  await gate.initialize("user-a", initialize);
  assert.equal(starts, 1);
});

test("allows a retry after a failed remote initialization", async () => {
  const gate = new RemoteSessionInitializationGate();
  await assert.rejects(() =>
    gate.initialize("user-a", async () => {
      throw new Error("remote unavailable");
    }),
  );

  let starts = 0;
  await gate.initialize("user-a", async () => {
    starts += 1;
  });
  assert.equal(starts, 1);
});

test("logout reset permits a future authenticated session to initialize", async () => {
  const gate = new RemoteSessionInitializationGate();
  let starts = 0;
  const initialize = async () => {
    starts += 1;
  };
  await gate.initialize("user-a", initialize);
  gate.reset();
  await gate.initialize("user-a", initialize);
  assert.equal(starts, 2);
});
