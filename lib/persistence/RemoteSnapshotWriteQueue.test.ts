import assert from "node:assert/strict";
import test from "node:test";
import type { AppFinancialData } from "../app/AppTypes";
import {
  fromRemoteSnapshot,
  normalizePersistedFinancialSnapshot,
  SupabaseSnapshotWriteError,
  toRemoteSnapshot,
} from "./SupabaseFinancialImportTarget";
import { RemoteSnapshotWriteQueue } from "./RemoteSnapshotWriteQueue";

const financialSnapshot: AppFinancialData = {
  expenses: [
    {
      id: 2,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna",
      amount: 123.45,
      date: "2026-09-02",
    },
    {
      id: 1,
      title: "Café",
      cat: "Alimentação",
      who: "Bruna",
      amount: 12,
      date: "2026-09-01",
      personalLimitBucket: "bruna_personal",
    },
  ],
  installments: [],
  debts: [],
  incomeEntries: [],
  income: 5000,
  budgets: { Alimentação: 600, Casa: 1200 },
  limits: { Bruna: 350, Matheus: 350 },
  personalLimits: {
    bruna_nails: 150,
    bruna_personal: 350,
    matheus_personal: 350,
  },
  creditCards: [
    {
      id: 3,
      name: "Test Card",
      owner: "Bruna",
      creditLimit: 1000,
      closingDay: 20,
      dueDay: 27,
      active: true,
    },
  ],
  invoicePayments: [],
  activeProfile: "Bruna",
  viewMonth: "2026-09",
};

test("confirms a semantically equal snapshot after the Supabase round-trip", async () => {
  const remote = toRemoteSnapshot(financialSnapshot);
  const returned = fromRemoteSnapshot({
    ...remote,
    expenses: [...remote.expenses].reverse(),
    settings: {
      ...remote.settings,
      budgets: { Casa: 1200, Alimentação: 600 },
    },
  });
  const queue = new RemoteSnapshotWriteQueue(
    normalizePersistedFinancialSnapshot,
    async () => returned,
  );
  queue.markConfirmed({ ...financialSnapshot, expenses: [] });

  await queue.enqueue(financialSnapshot);
});

test("rejects a financial divergence returned by the remote snapshot", async () => {
  const queue = new RemoteSnapshotWriteQueue(
    normalizePersistedFinancialSnapshot,
    async () => ({
      ...financialSnapshot,
      expenses: [{ ...financialSnapshot.expenses[0], amount: 999 }],
    }),
  );
  queue.markConfirmed({ ...financialSnapshot, expenses: [] });

  await assert.rejects(
    () => queue.enqueue(financialSnapshot),
    /não reconciliou/,
  );
});

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
  let releaseWrite!: () => void;
  let signalPersistStarted!: () => void;
  const persistStarted = new Promise<void>((resolve) => {
    signalPersistStarted = resolve;
  });
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async (snapshot) => {
      await new Promise<void>((resolve) => {
        releaseWrite = resolve;
        signalPersistStarted();
      });
      return snapshot;
    },
  );
  queue.markConfirmed({ revision: 0 });
  const pendingWrite = queue.enqueue({ revision: 1 });
  await persistStarted;
  const pendingLogout = queue.flush({ revision: 1 });
  let completed = false;
  void pendingLogout.then(() => {
    completed = true;
  });

  assert.equal(completed, false);
  releaseWrite();
  await Promise.all([pendingWrite, pendingLogout]);
  assert.equal(completed, true);
});

test("keeps a failed remote write observable without any local fallback", async () => {
  let attempts = 0;
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async (snapshot) => {
      attempts += 1;
      if (attempts === 1) throw new Error("remote unavailable");
      return snapshot;
    },
  );
  queue.markConfirmed({ revision: 0 });

  await assert.rejects(
    () => queue.flush({ revision: 1 }),
    /remote unavailable/,
  );
  await queue.enqueue({ revision: 1 }, true);
  await queue.enqueue({ revision: 1 });
  assert.equal(attempts, 2);
});

test("preserves the sanitized Supabase diagnostic through the write queue", async () => {
  const failure = new SupabaseSnapshotWriteError(
    { code: "42501", message: "permission denied", status: 403 },
    { rpcStarted: true, rpcResponded: true },
  );
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async () => {
      throw failure;
    },
  );
  queue.markConfirmed({ revision: 0 });

  await assert.rejects(
    () => queue.enqueue({ revision: 1 }),
    (error: unknown) => error === failure,
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

test("flush waits for the newest snapshot when a newer mutation follows an active write", async () => {
  const persisted: number[] = [];
  let releaseFirst: (() => void) | undefined;
  let firstStarted: (() => void) | undefined;
  const queue = new RemoteSnapshotWriteQueue(
    (snapshot: { revision: number }) => String(snapshot.revision),
    async (snapshot) => {
      persisted.push(snapshot.revision);
      if (snapshot.revision === 1) {
        firstStarted?.();
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return snapshot;
    },
  );
  queue.markConfirmed({ revision: 0 });
  const first = queue.enqueue({ revision: 1 });
  await new Promise<void>((resolve) => {
    firstStarted = resolve;
  });
  const second = queue.enqueue({ revision: 2 });
  const pendingLogout = queue.flush({ revision: 2 });

  releaseFirst?.();
  await Promise.all([first, second, pendingLogout]);
  assert.deepEqual(persisted, [1, 2]);
});
