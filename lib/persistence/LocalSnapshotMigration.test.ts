import assert from "node:assert/strict";
import test from "node:test";
import type { AppFinancialData } from "../app/AppTypes";
import {
  importLocalSnapshot,
  previewLocalMigration,
  type FinancialImportTarget,
} from "./LocalSnapshotMigration";

const snapshot: AppFinancialData = {
  expenses: [
    {
      id: 1,
      title: "Teste",
      cat: "Casa",
      who: "Bruna",
      amount: 12.5,
      date: "2026-09-01",
    },
  ],
  installments: [],
  debts: [],
  incomeEntries: [],
  income: 1000,
  budgets: {},
  limits: { Bruna: 350, Matheus: 350 },
  personalLimits: {
    bruna_nails: 150,
    bruna_personal: 350,
    matheus_personal: 350,
  },
  creditCards: [],
  invoicePayments: [],
  activeProfile: "Bruna",
  viewMonth: "2026-09",
};

function target(): {
  target: FinancialImportTarget;
  marks: number;
  imports: number;
} {
  const imports = new Set<string>();
  let stored = structuredClone(snapshot);
  let marks = 0;
  let writes = 0;
  return {
    get marks() {
      return marks;
    },
    get imports() {
      return writes;
    },
    target: {
      hasImport: async (_, sourceHash) => imports.has(sourceHash),
      importAtomically: async (_, value, sourceHash) => {
        stored = structuredClone(value);
        writes += 1;
        imports.add(sourceHash);
        marks += 1;
        return structuredClone(stored);
      },
    },
  };
}

test("previews a local snapshot without mutating it", () => {
  const before = structuredClone(snapshot);
  const preview = previewLocalMigration(snapshot);
  assert.equal(preview.valid, true);
  assert.deepEqual(preview.counts, {
    expenses: 1,
    installments: 0,
    receivables: 0,
    incomeEntries: 0,
    creditCards: 0,
    invoicePayments: 0,
  });
  assert.deepEqual(snapshot, before);
});

test("rejects every invalid or duplicate legacy ID before any write", async () => {
  for (const key of [
    "expenses",
    "installments",
    "debts",
    "incomeEntries",
    "creditCards",
    "invoicePayments",
  ] as const) {
    const invalid = structuredClone(snapshot);
    (invalid[key] as { id: number }[]).push({ id: 1.5 } as never);
    const preview = previewLocalMigration(invalid);
    assert.equal(preview.valid, false, key);
    await assert.rejects(() =>
      importLocalSnapshot({ target: target().target, householdId: "household", snapshot: invalid }),
    );
  }
});

test("rejects orphaned legacy card references before any write", () => {
  const invalid = structuredClone(snapshot);
  invalid.expenses[0]!.creditCardId = 99;
  assert.equal(previewLocalMigration(invalid).valid, false);
});

test("fails reconciliation when persisted financial content differs despite equal counts", async () => {
  const fake = target();
  fake.target.importAtomically = async () => ({
    ...structuredClone(snapshot),
    expenses: [{ ...snapshot.expenses[0]!, amount: 99 }],
  });
  await assert.rejects(() =>
    importLocalSnapshot({ target: fake.target, householdId: "household", snapshot }),
  );
  assert.equal(fake.marks, 0);
});

test("imports once, reconciles, and marks only after complete success", async () => {
  const fake = target();
  const first = await importLocalSnapshot({
    target: fake.target,
    householdId: "household",
    snapshot,
  });
  const second = await importLocalSnapshot({
    target: fake.target,
    householdId: "household",
    snapshot,
  });
  assert.equal(first.imported, true);
  assert.equal(second.imported, false);
  assert.equal(fake.imports, 1);
  assert.equal(fake.marks, 1);
});
