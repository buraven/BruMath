import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionRepository } from "../../finance/TransactionRepository";
import type { Transaction } from "../../finance/transactions";
import {
  confirmAction,
  createActionGateway,
  type ConfirmedAction,
} from "./ActionGateway";
import {
  createRegisterExpenseAction,
  createRegisterExpenseProposal,
} from "./registerExpenseAction";

function createRepository(shouldFail = false): {
  repository: TransactionRepository;
  saved: Transaction[];
} {
  const saved: Transaction[] = [];
  return {
    saved,
    repository: {
      getAll: async () => saved,
      getById: async (id) =>
        saved.find((transaction) => transaction.id === id) ?? null,
      save: async (transaction) => {
        if (shouldFail) throw new Error("Storage unavailable");
        saved.push(transaction);
      },
      update: async () => undefined,
      delete: async () => undefined,
    },
  };
}

function proposal() {
  return createRegisterExpenseProposal({
    id: "expense:100",
    description: "Mercado",
    amount: 85,
    category: "Alimentação",
    owner: "Bruna",
    date: "2026-09-08",
  });
}

test("creating or cancelling a proposal never persists a transaction", () => {
  const { saved } = createRepository();
  const pending = proposal();

  assert.equal(pending.kind, "register-expense");
  assert.equal(saved.length, 0);
  // Cancellation is intentionally a no-op: the gateway is never invoked.
  assert.equal(saved.length, 0);
});

test("rejects execution without a confirmed action", async () => {
  const { repository, saved } = createRepository();
  const gateway = createActionGateway([
    createRegisterExpenseAction(repository),
  ]);

  await assert.rejects(() =>
    gateway.execute(proposal() as unknown as ConfirmedAction),
  );
  assert.equal(saved.length, 0);
});

test("persists exactly the confirmed register-expense payload once", async () => {
  const { repository, saved } = createRepository();
  const gateway = createActionGateway([
    createRegisterExpenseAction(repository),
  ]);
  const pending = proposal();
  const confirmed = confirmAction(pending, {
    id: "confirmation:100",
    confirmedAt: "2026-09-08T12:00:00.000Z",
  });

  const first = await gateway.execute(confirmed);
  const second = await gateway.execute(confirmed);

  assert.deepEqual(first, {
    ok: true,
    message: "Gasto registrado.",
    referenceId: "expense:100",
  });
  assert.equal(second.ok, false);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], {
    id: "expense:100",
    description: "Mercado",
    amount: 85,
    category: "Alimentação",
    owner: "Bruna",
    type: "expense",
    date: "2026-09-08",
  });
});

test("does not report persistence errors as success", async () => {
  const { repository, saved } = createRepository(true);
  const gateway = createActionGateway([
    createRegisterExpenseAction(repository),
  ]);
  const confirmed = confirmAction(proposal(), {
    id: "confirmation:failed",
    confirmedAt: "2026-09-08T12:00:00.000Z",
  });

  const result = await gateway.execute(confirmed);

  assert.deepEqual(result, {
    ok: false,
    code: "execution-failed",
    message: "Não foi possível executar a ação confirmada.",
  });
  assert.equal(saved.length, 0);
});
