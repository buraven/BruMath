import assert from "node:assert/strict";
import test from "node:test";
import { RemoteSnapshotWriteQueue } from "./RemoteSnapshotWriteQueue";

test("serializes rapid mutations and persists the newest snapshot", async () => {
  const persisted: number[] = [];
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async (snapshot) => {
      persisted.push(snapshot.revision);
      return snapshot;
    },
  );
  queue.markConfirmed({ revision: 0 });

  await Promise.all([
    queue.enqueue({ revision: 1 }),
    queue.enqueue({ revision: 2 }),
  ]);

  assert.deepEqual(persisted, [2]);
});

test("flush waits for a pending remote write before logout can continue", async () => {
  let release: (() => void) | undefined;
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async (snapshot) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return snapshot;
    },
  );
  queue.markConfirmed({ revision: 0 });
  void queue.enqueue({ revision: 1 });
  const pendingLogout = queue.flush({ revision: 1 });
  let completed = false;
  void pendingLogout.then(() => {
    completed = true;
  });

  await Promise.resolve();
  assert.equal(completed, false);
  release?.();
  await pendingLogout;
  assert.equal(completed, true);
});

test("keeps a failed remote write observable without any local fallback", async () => {
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async () => {
      throw new Error("remote unavailable");
    },
  );
  queue.markConfirmed({ revision: 0 });

  await assert.rejects(
    () => queue.flush({ revision: 1 }),
    /remote unavailable/,
  );
});

test("uses the same queue for installment create, edit and delete snapshots", async () => {
  const persisted: number[][] = [];
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { installmentIds: readonly number[] }) =>
      JSON.stringify(snapshot.installmentIds),
    async (snapshot) => {
      persisted.push([...snapshot.installmentIds]);
      return snapshot;
    },
  );
  queue.markConfirmed({ installmentIds: [] });

  await queue.enqueue({ installmentIds: [1] });
  await queue.enqueue({ installmentIds: [1, 2] });
  await queue.enqueue({ installmentIds: [2] });

  assert.deepEqual(persisted, [[1], [1, 2], [2]]);
});
