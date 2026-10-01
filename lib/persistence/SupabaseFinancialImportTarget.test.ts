import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppFinancialData } from "../app/AppTypes";
import {
  hydrateCategoryCatalog,
  legacyCategoryId,
} from "../finance/categoryCatalog";
import {
  fromRemoteSnapshot,
  normalizePersistedFinancialSnapshot,
  remotePersistenceDiagnostic,
  type RemoteSnapshot,
  materializeSupabaseLegacyScheduleClassA,
  replaceSupabaseFinancialSnapshot,
  simulateImportV2RoundTrip,
  SupabaseImportRpcError,
  SupabaseFinancialImportTarget,
  SupabaseSnapshotWriteError,
  toLegacyImportSnapshot,
  toRemoteSnapshot,
} from "./SupabaseFinancialImportTarget";
import { applyProspectiveInstallmentEdit } from "../finance/installmentProspectiveEdit";
import { bootstrapFinancialHousehold } from "./supabaseAuth";

function structuralDiffPaths(
  source: unknown,
  persisted: unknown,
  path = "",
): string[] {
  if (Object.is(source, persisted)) return [];
  if (
    !source ||
    !persisted ||
    typeof source !== "object" ||
    typeof persisted !== "object"
  ) {
    return [path || "$"];
  }

  const sourceRecord = source as Record<string, unknown>;
  const persistedRecord = persisted as Record<string, unknown>;
  return [
    ...new Set([...Object.keys(sourceRecord), ...Object.keys(persistedRecord)]),
  ]
    .sort()
    .flatMap((key) =>
      structuralDiffPaths(
        sourceRecord[key],
        persistedRecord[key],
        path ? `${path}.${key}` : key,
      ),
    );
}

const snapshot: AppFinancialData = {
  expenses: [
    {
      id: 8,
      title: "Almoço",
      cat: "Alimentação",
      who: "Bruna",
      amount: 25,
      date: "2026-09-02",
      personalLimitBucket: "bruna_personal",
      creditCardId: 4,
    },
  ],
  installments: [],
  debts: [],
  incomeEntries: [],
  income: 1000,
  budgets: { Casa: 200 },
  limits: { Bruna: 350, Matheus: 350 },
  personalLimits: {
    bruna_nails: 150,
    bruna_personal: 350,
    matheus_personal: 350,
  },
  creditCards: [
    {
      id: 4,
      name: "Nubank",
      owner: "Bruna",
      creditLimit: 5000,
      closingDay: 20,
      dueDay: 27,
      active: true,
    },
  ],
  invoicePayments: [],
  invoiceAdjustments: [],
  installmentInvoiceEvents: [],
  installmentReimbursementAllocations: [],
  activeProfile: "Bruna",
  viewMonth: "2026-09",
};

function snapshotWithSchedule(): AppFinancialData {
  return {
    ...snapshot,
    installments: [
      {
        id: 12,
        title: "Plano sintético",
        category: "Casa",
        who: "Bruna",
        amount: 100,
        totalInstallments: 3,
        paidInstallments: 0,
        nextDue: "2026-09-27",
        creditCardId: 4,
      },
    ],
    installmentScheduleItems: [
      {
        id: "installment:12:1",
        installmentId: 12,
        installmentNumber: 1,
        totalInstallments: 3,
        amount: 33.34,
        invoiceReferenceMonth: "2026-09",
        dueDate: "2026-09-27",
        creditCardId: 4,
        status: "scheduled",
      },
      {
        id: "installment:12:2",
        installmentId: 12,
        installmentNumber: 2,
        totalInstallments: 3,
        amount: 33.33,
        invoiceReferenceMonth: "2026-10",
        dueDate: "2026-10-27",
        creditCardId: 4,
        status: "scheduled",
      },
      {
        id: "installment:12:3",
        installmentId: 12,
        installmentNumber: 3,
        totalInstallments: 3,
        amount: 33.33,
        invoiceReferenceMonth: "2026-11",
        dueDate: "2026-11-27",
        creditCardId: 4,
        status: "scheduled",
      },
    ],
  };
}

function snapshotWithSettlement(): AppFinancialData {
  return {
    ...snapshotWithSchedule(),
    installmentSettlementEvents: [
      {
        id: "settlement:12:1",
        installmentId: 12,
        installmentNumber: 1,
        amount: 33.34,
        settledAt: "2026-09-27",
        type: "regular",
      },
    ],
  };
}

test("maps a local snapshot to the deterministic RPC representation", () => {
  const remote = toRemoteSnapshot(snapshot);
  assert.equal(remote.settings.view_month, "2026-09-01");
  assert.deepEqual(remote.expenses[0], {
    legacy_id: 8,
    title: "Almoço",
    category: "Alimentação",
    responsible: "Bruna",
    amount: 25,
    occurred_on: "2026-09-02",
    personal_limit_bucket: "bruna_personal",
    credit_card_legacy_id: 4,
    invoice_reference_month: null,
  });
  assert.deepEqual(fromRemoteSnapshot(remote), snapshot);
});

test("round-trips an edited base income through the remote snapshot settings", () => {
  const edited = { ...snapshot, income: 14_250 };
  const remote = toRemoteSnapshot(edited);

  assert.equal(remote.settings.income, 14_250);
  assert.equal(fromRemoteSnapshot(remote).income, 14_250);
  assert.equal(fromRemoteSnapshot(remote).incomeEntries.length, 0);
});

test("round-trips the additive category catalog and stable fact references", () => {
  const categorized = {
    ...snapshot,
    categories: [
      { id: "category:food", name: "Alimentação", active: true, sortOrder: 0 },
      {
        id: "category:archive",
        name: "Alimentação",
        active: false,
        sortOrder: 1,
      },
    ],
    expenses: [{ ...snapshot.expenses[0]!, categoryId: "category:archive" }],
    installments: [
      {
        id: 12,
        title: "Plano",
        category: "Alimentação",
        categoryId: "category:food",
        who: "Casal" as const,
        amount: 50,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-10-01",
      },
    ],
  };
  const remote = toRemoteSnapshot(categorized);
  assert.equal(remote.categories?.[1]?.active, false);
  assert.equal(remote.expenses[0]?.category_legacy_id, "category:archive");
  assert.equal(remote.installments[0]?.category_legacy_id, "category:food");
  assert.deepEqual(fromRemoteSnapshot(remote), categorized);
});

test("round-trips V4 identity budgets without recreating a legacy name bucket", () => {
  const categorized = {
    ...snapshot,
    budgets: {},
    categoryBudgets: { "category:food": 1400 },
    categories: [
      { id: "category:food", name: "Comida", active: true, sortOrder: 0 },
    ],
    expenses: [{ ...snapshot.expenses[0]!, categoryId: "category:food" }],
  };
  const remote = toRemoteSnapshot(categorized);

  assert.deepEqual(remote.settings.category_budgets, {
    "category:food": 1400,
  });
  assert.deepEqual(remote.settings.budgets, {});
  assert.deepEqual(fromRemoteSnapshot(remote), categorized);
});

test("round-trips the additive V4 installment schedule in canonical order", () => {
  const scheduled = snapshotWithSchedule();
  const remote = toRemoteSnapshot(scheduled);

  assert.deepEqual(remote.installment_schedule_items?.[0], {
    legacy_id: "installment:12:1",
    installment_legacy_id: 12,
    installment_number: 1,
    total_installments: 3,
    amount: 33.34,
    invoice_reference_month: "2026-09-01",
    due_date: "2026-09-27",
    credit_card_legacy_id: 4,
    status: "scheduled",
  });
  assert.deepEqual(fromRemoteSnapshot(remote), scheduled);
  assert.equal(
    normalizePersistedFinancialSnapshot(scheduled),
    normalizePersistedFinancialSnapshot({
      ...scheduled,
      installmentScheduleItems: [
        ...scheduled.installmentScheduleItems!,
      ].reverse(),
    }),
  );
});

test("round-trips a cancelled V4 schedule item without changing its identity", () => {
  const scheduled = snapshotWithSchedule();
  const cancelled = {
    ...scheduled,
    installmentScheduleItems: scheduled.installmentScheduleItems?.map((item) =>
      item.installmentNumber === 3
        ? { ...item, status: "cancelled" as const }
        : item,
    ),
  };

  const remote = toRemoteSnapshot(cancelled);
  assert.equal(remote.installment_schedule_items?.[2]?.status, "cancelled");
  assert.deepEqual(fromRemoteSnapshot(remote), cancelled);
  assert.equal(
    normalizePersistedFinancialSnapshot(cancelled),
    normalizePersistedFinancialSnapshot(fromRemoteSnapshot(remote)),
  );
});

test("keeps snapshots without a schedule field backward compatible", () => {
  const remote = toRemoteSnapshot(snapshot);
  assert.equal(remote.installment_schedule_items, undefined);
  assert.equal(
    Object.hasOwn(fromRemoteSnapshot(remote), "installmentScheduleItems"),
    false,
  );

  const explicitEmpty = {
    ...remote,
    installment_schedule_items: [],
  };
  assert.deepEqual(
    fromRemoteSnapshot(explicitEmpty).installmentScheduleItems,
    [],
  );
});

test("round-trips an immutable V4 settlement without card or invoice fields", () => {
  const settled = snapshotWithSettlement();
  const remote = toRemoteSnapshot(settled);

  assert.deepEqual(remote.installment_settlement_events, [
    {
      legacy_id: "settlement:12:1",
      installment_legacy_id: 12,
      installment_number: 1,
      amount: 33.34,
      settled_on: "2026-09-27",
      settlement_type: "regular",
    },
  ]);
  assert.deepEqual(fromRemoteSnapshot(remote), settled);
  assert.doesNotMatch(
    JSON.stringify(remote.installment_settlement_events),
    /card|reference_month/i,
  );
});

test("keeps settlement events optional for legacy snapshots and reconciles every fact when present", () => {
  const legacy = toRemoteSnapshot(snapshotWithSchedule());
  assert.equal(legacy.installment_settlement_events, undefined);
  assert.equal(
    Object.hasOwn(fromRemoteSnapshot(legacy), "installmentSettlementEvents"),
    false,
  );

  const settled = toRemoteSnapshot(snapshotWithSettlement());
  const original = settled.installment_settlement_events?.[0]!;
  for (const [field, value] of Object.entries({
    installment_number: 2,
    amount: 33.33,
    settled_on: "2026-09-28",
    settlement_type: "anticipated",
  })) {
    assert.deepEqual(
      structuralDiffPaths(settled, {
        ...settled,
        installment_settlement_events: [{ ...original, [field]: value }],
      }),
      [`installment_settlement_events.0.${field}`],
    );
  }
  assert.deepEqual(
    structuralDiffPaths(settled, {
      ...settled,
      installment_settlement_events: [],
    }),
    ["installment_settlement_events.0"],
  );
});

test("keeps every schedule field inside the V4 reconciliation contract", () => {
  const scheduled: AppFinancialData = {
    ...snapshot,
    installmentScheduleItems: [
      {
        id: "installment:12:1",
        installmentId: 12,
        installmentNumber: 1,
        totalInstallments: 2,
        amount: 50,
        invoiceReferenceMonth: "2026-09",
        dueDate: "2026-09-27",
        creditCardId: 4,
        status: "scheduled",
      },
    ],
  };
  const source = toRemoteSnapshot(scheduled);
  const original = source.installment_schedule_items?.[0]!;
  for (const [field, value] of Object.entries({
    amount: 49,
    installment_number: 2,
    invoice_reference_month: "2026-10-01",
    due_date: "2026-10-28",
    credit_card_legacy_id: null,
    status: "other",
  })) {
    const persisted = {
      ...source,
      installment_schedule_items: [{ ...original, [field]: value }],
    };
    assert.deepEqual(structuralDiffPaths(source, persisted), [
      `installment_schedule_items.0.${field}`,
    ]);
  }
  assert.deepEqual(
    structuralDiffPaths(source, {
      ...source,
      installment_schedule_items: [],
    }),
    ["installment_schedule_items.0"],
  );
  assert.deepEqual(
    structuralDiffPaths(source, {
      ...source,
      installment_schedule_items: [
        ...source.installment_schedule_items!,
        original,
      ],
    }),
    ["installment_schedule_items.1"],
  );
});

test("projects V4 category budgets before the V1 reconciliation boundary", () => {
  const v4Source = toRemoteSnapshot({
    ...snapshot,
    budgets: { "Histórico não resolvido": 0 },
    categoryBudgets: { "legacy:alimentação": 1400 },
    categories: [
      {
        id: "legacy:alimentação",
        name: "Alimentação",
        active: true,
        sortOrder: 0,
      },
      {
        id: "category:archived-food",
        name: "Alimentação",
        active: false,
        sortOrder: 1,
      },
    ],
    expenses: [{ ...snapshot.expenses[0]!, categoryId: "legacy:alimentação" }],
    installments: [
      {
        id: 12,
        title: "Plano",
        category: "Alimentação",
        categoryId: "legacy:alimentação",
        who: "Casal",
        amount: 50,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-10-01",
      },
    ],
  });

  // This is the V3 projection sent to V2/V1 today: V3 correctly removes its
  // own category fields, but leaves the V4-only settings field intact.
  const { categories: _categories, ...v3ToV1Source } = v4Source;
  const v1Source = {
    ...v3ToV1Source,
    expenses: v3ToV1Source.expenses.map(
      ({ category_legacy_id: _categoryId, ...expense }) => expense,
    ),
    installments: v3ToV1Source.installments.map(
      ({ category_legacy_id: _categoryId, ...installment }) => installment,
    ),
  };

  // The legacy V1 read-back builds settings from its pre-V4 columns and so
  // cannot include category_budgets during its own reconciliation guard.
  const { category_budgets: _categoryBudgets, ...v1Settings } =
    v1Source.settings;
  const v1ReadBack = { ...v1Source, settings: v1Settings };

  assert.deepEqual(structuralDiffPaths(v1Source, v1ReadBack), [
    "settings.category_budgets",
  ]);

  // The incremental V4 migration projects only this V4-owned field before
  // calling V3/V2/V1. The base guard can then remain exact and strict.
  const v4Projection = { ...v1Source, settings: v1Settings };
  assert.deepEqual(structuralDiffPaths(v4Projection, v1ReadBack), []);
  assert.deepEqual(v4Source.settings.category_budgets, {
    "legacy:alimentação": 1400,
  });
  assert.deepEqual(v4Source.settings.budgets, { "Histórico não resolvido": 0 });
});

test("keeps a promoted legacy budget stable through rename, V4 persistence and rehydration", () => {
  const categoryId = legacyCategoryId("Alimentação");
  const legacy: AppFinancialData = {
    ...snapshot,
    budgets: { Alimentação: 1400 },
    categories: [
      {
        id: categoryId,
        name: "Alimentação",
        active: true,
        sortOrder: 0,
      },
    ],
    expenses: [{ ...snapshot.expenses[0]!, categoryId }],
    installments: [
      {
        id: 12,
        title: "Plano",
        category: "Alimentação",
        categoryId,
        who: "Casal",
        amount: 50,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-10-01",
      },
    ],
  };
  const promoted = hydrateCategoryCatalog(legacy);
  const renamed = {
    ...promoted,
    categories: promoted.categories.map((category) =>
      category.id === categoryId ? { ...category, name: "Comida" } : category,
    ),
  };
  const rehydrated = hydrateCategoryCatalog(
    fromRemoteSnapshot(toRemoteSnapshot(renamed)),
  );

  assert.equal(
    rehydrated.categories.find((category) => category.id === categoryId)?.name,
    "Comida",
  );
  assert.equal(rehydrated.categoryBudgets?.[categoryId], 1400);
  assert.equal(rehydrated.budgets.Alimentação, undefined);
  assert.equal(Object.keys(rehydrated.categoryBudgets ?? {}).length, 1);
  assert.equal(rehydrated.expenses[0]?.categoryId, categoryId);
  assert.equal(rehydrated.installments[0]?.categoryId, categoryId);
  assert.equal(
    rehydrated.expenses.reduce((total, expense) => total + expense.amount, 0) +
      rehydrated.installments.reduce(
        (total, installment) => total + installment.amount,
        0,
      ),
    legacy.expenses.reduce((total, expense) => total + expense.amount, 0) +
      legacy.installments.reduce(
        (total, installment) => total + installment.amount,
        0,
      ),
  );
});

test("round-trips optional historical invoice facts without changing legacy snapshots", () => {
  const enriched: AppFinancialData = {
    ...snapshot,
    expenses: [{ ...snapshot.expenses[0]!, invoiceReferenceMonth: "2026-09" }],
    invoiceAdjustments: [
      {
        id: 20,
        cardId: 4,
        referenceMonth: "2026-09",
        type: "discount",
        amount: -2.5,
        description: "Desconto",
      },
    ],
    installmentInvoiceEvents: [],
    installmentReimbursementAllocations: [
      {
        id: 21,
        installmentId: 7,
        person: "Terceiro",
        installmentNumber: 2,
        amount: 200,
        expectedMonth: "2026-10",
        status: "future",
      },
    ],
  };
  const remote = toRemoteSnapshot(enriched);
  assert.equal(remote.expenses[0]?.invoice_reference_month, "2026-09-01");
  assert.equal(remote.invoice_adjustments?.[0]?.amount, -2.5);
  assert.deepEqual(fromRemoteSnapshot(remote), enriched);
});

test("projects v2 additions away only for the legacy RPC, then restores their canonical contract", () => {
  const enriched: AppFinancialData = {
    ...snapshot,
    expenses: [{ ...snapshot.expenses[0]!, invoiceReferenceMonth: "2026-10" }],
    installments: [
      {
        id: 7,
        title: "Plano sintético",
        category: "Teste",
        who: "Bruna",
        amount: 50,
        totalInstallments: 3,
        paidInstallments: 1,
        nextDue: "2026-10-01",
        creditCardId: 4,
      },
    ],
    invoiceAdjustments: [
      {
        id: 20,
        cardId: 4,
        referenceMonth: "2026-10",
        type: "previous_balance",
        amount: 10,
        description: "Saldo anterior",
      },
    ],
    installmentInvoiceEvents: [
      {
        id: 21,
        installmentId: 7,
        cardId: 4,
        referenceMonth: "2026-10",
        installmentNumber: 2,
        amount: 50,
        type: "anticipated",
      },
    ],
    installmentReimbursementAllocations: [
      {
        id: 22,
        installmentId: 7,
        person: "Terceiro",
        installmentNumber: 2,
        amount: 75,
        expectedMonth: "2026-11",
        status: "future",
      },
    ],
  };
  const remote = toRemoteSnapshot(enriched);
  const legacy = toLegacyImportSnapshot(remote);

  assert.equal(legacy.expenses[0]?.invoice_reference_month, undefined);
  assert.equal(legacy.invoice_adjustments, undefined);
  assert.equal(legacy.installment_invoice_events, undefined);
  assert.equal(legacy.installment_reimbursement_allocations, undefined);
  assert.equal(
    normalizePersistedFinancialSnapshot(simulateImportV2RoundTrip(enriched)),
    normalizePersistedFinancialSnapshot(enriched),
  );
});

test("preserves month competences through date persistence while requiring civil installment dates", () => {
  const monthly: AppFinancialData = {
    ...snapshot,
    installments: [
      {
        id: 7,
        title: "Parcela sintética",
        category: "Teste",
        who: "Bruna",
        amount: 10,
        totalInstallments: 4,
        paidInstallments: 1,
        nextDue: "2026-10-01",
        creditCardId: 4,
      },
    ],
    debts: [
      {
        id: 30,
        person: "Terceiro",
        amount: 10,
        paid: 0,
        destination: "casal",
        note: "Teste",
        month: "2026-10",
        receivedMonth: "2026-11",
      },
    ],
    invoicePayments: [
      {
        id: 31,
        cardId: 4,
        referenceMonth: "2027-01",
        paidAt: "2027-01-05",
        amount: 10,
      },
    ],
    invoiceAdjustments: [
      {
        id: 32,
        cardId: 4,
        referenceMonth: "2026-09",
        type: "credit",
        amount: -1,
        description: "Crédito",
      },
    ],
    installmentInvoiceEvents: [
      {
        id: 33,
        installmentId: 7,
        cardId: 4,
        referenceMonth: "2026-10",
        installmentNumber: 2,
        amount: 10,
        type: "regular",
      },
    ],
    installmentReimbursementAllocations: [
      {
        id: 34,
        installmentId: 7,
        person: "Terceiro",
        installmentNumber: 2,
        amount: 10,
        expectedMonth: "2026-11",
        status: "future",
      },
    ],
  };
  const remote = toRemoteSnapshot(monthly);
  assert.deepEqual(
    [
      remote.settings.view_month,
      remote.receivables[0]?.competence_month,
      remote.receivables[0]?.received_month,
      remote.invoice_payments[0]?.reference_month,
      remote.invoice_adjustments?.[0]?.reference_month,
      remote.installment_invoice_events?.[0]?.reference_month,
      remote.installment_reimbursement_allocations?.[0]?.expected_month,
    ],
    [
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2027-01-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
    ],
  );
  assert.deepEqual(fromRemoteSnapshot(remote), monthly);
  assert.throws(
    () =>
      toRemoteSnapshot({
        ...monthly,
        installments: [{ ...monthly.installments[0]!, nextDue: "2026-10" }],
      }),
    /nextDue deve usar o formato YYYY-MM-DD/,
  );
});

test("uses the import RPC and returns its persisted snapshot", async () => {
  let rpcName = "";
  let rpcArguments: Record<string, unknown> | undefined;
  const client = {
    rpc: async (name: string, arguments_: Record<string, unknown>) => {
      rpcName = name;
      rpcArguments = arguments_;
      return {
        data: { imported: true, snapshot: toRemoteSnapshot(snapshot) },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  const target = new SupabaseFinancialImportTarget(client);

  const persisted = await target.importAtomically(
    "household",
    snapshot,
    "hash",
    {
      expenses: 1,
      installments: 0,
      receivables: 0,
      incomeEntries: 0,
      creditCards: 1,
      invoicePayments: 0,
    },
  );

  assert.equal(rpcName, "import_financial_snapshot_v4");
  assert.equal(rpcArguments?.p_household_id, "household");
  assert.equal(rpcArguments?.p_source_hash, "hash");
  assert.deepEqual(Object.keys(rpcArguments ?? {}).sort(), [
    "p_household_id",
    "p_snapshot",
    "p_source_hash",
    "p_summary",
  ]);
  assert.ok(rpcArguments?.p_snapshot);
  assert.ok(rpcArguments?.p_summary);
  assert.deepEqual(persisted, snapshot);
});

test("transports an explicit schedule through import V4", async () => {
  const scheduled = snapshotWithSchedule();
  let rpcSnapshot: unknown;
  const client = {
    rpc: async (_name: string, arguments_: Record<string, unknown>) => {
      rpcSnapshot = arguments_.p_snapshot;
      return {
        data: { imported: true, snapshot: arguments_.p_snapshot },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  const result = await new SupabaseFinancialImportTarget(
    client,
  ).importAtomically("household", scheduled, "hash", {
    expenses: 1,
    installments: 1,
    receivables: 0,
    incomeEntries: 0,
    creditCards: 1,
    invoicePayments: 0,
  });

  assert.equal(
    (rpcSnapshot as RemoteSnapshot).installment_schedule_items?.length,
    3,
  );
  assert.deepEqual(
    result.installmentScheduleItems,
    scheduled.installmentScheduleItems,
  );
});

test("transports immutable settlement events through import V4", async () => {
  const settled = snapshotWithSettlement();
  let rpcSnapshot: unknown;
  const client = {
    rpc: async (_name: string, arguments_: Record<string, unknown>) => {
      rpcSnapshot = arguments_.p_snapshot;
      return {
        data: { imported: true, snapshot: arguments_.p_snapshot },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  const result = await new SupabaseFinancialImportTarget(
    client,
  ).importAtomically("household", settled, "hash", {
    expenses: 1,
    installments: 1,
    receivables: 0,
    incomeEntries: 0,
    creditCards: 1,
    invoicePayments: 0,
  });

  assert.equal(
    (rpcSnapshot as RemoteSnapshot).installment_settlement_events?.length,
    1,
  );
  assert.deepEqual(
    result.installmentSettlementEvents,
    settled.installmentSettlementEvents,
  );
});

test("round-trips an atomically edited installment and its schedule through V4", () => {
  const source = snapshotWithSettlement();
  const plan = source.installments[0]!;
  const result = applyProspectiveInstallmentEdit({
    installment: plan,
    scheduleItems: source.installmentScheduleItems!,
    historyFacts: {
      installmentSettlementEvents: source.installmentSettlementEvents,
      installmentInvoiceEvents: source.installmentInvoiceEvents,
    },
    edit: { futureTotalAmount: 50, futureCreditCardId: 8 },
  });
  const edited: AppFinancialData = {
    ...source,
    installments: [result.installment],
    installmentScheduleItems: result.scheduleItems,
  };
  assert.deepEqual(fromRemoteSnapshot(toRemoteSnapshot(edited)), edited);
  assert.deepEqual(
    edited.installmentSettlementEvents,
    source.installmentSettlementEvents,
  );
});

test("reads category budgets from an idempotent V4 import response", async () => {
  const categorized = {
    ...snapshot,
    budgets: {},
    categoryBudgets: { "category:food": 1400 },
    categories: [
      { id: "category:food", name: "Comida", active: true, sortOrder: 0 },
    ],
  };
  const client = {
    rpc: async () => ({
      data: { imported: false, snapshot: toRemoteSnapshot(categorized) },
      error: null,
    }),
  } as unknown as SupabaseClient;
  const target = new SupabaseFinancialImportTarget(client);

  const persisted = await target.importAtomically(
    "household",
    categorized,
    "hash",
    {
      expenses: 1,
      installments: 0,
      receivables: 0,
      incomeEntries: 0,
      creditCards: 1,
      invoicePayments: 0,
    },
  );

  assert.equal(persisted.categoryBudgets?.["category:food"], 1400);
  assert.deepEqual(persisted.budgets, {});
});

test("preserves sanitized RPC metadata instead of replacing it with a generic error", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: {
        code: "42883",
        message: "function public.import_financial_snapshot_v4 does not exist",
        details: "No function matches the given name and argument types.",
        hint: "Check the function signature.",
      },
    }),
  } as unknown as SupabaseClient;
  const target = new SupabaseFinancialImportTarget(client);
  await assert.rejects(
    () =>
      target.importAtomically("household", snapshot, "hash", {
        expenses: 1,
        installments: 0,
        receivables: 0,
        incomeEntries: 0,
        creditCards: 1,
        invoicePayments: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof SupabaseImportRpcError);
      assert.deepEqual(error.diagnostic(), {
        stage: "import_financial_snapshot_v4",
        function: "SupabaseFinancialImportTarget.importAtomically",
        rpcStarted: true,
        rpcResponded: true,
        code: "42883",
        message: "function public.import_financial_snapshot_v4 does not exist",
        details: "No function matches the given name and argument types.",
        hint: "Check the function signature.",
      });
      return true;
    },
  );
});

test("does not treat a remote import lookup failure as a missing import", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: { message: "offline" },
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  const target = new SupabaseFinancialImportTarget(client);
  await assert.rejects(() => target.hasImport("household", "hash"));
});

test("writes a runtime snapshot only through the atomic replacement RPC", async () => {
  let rpcName = "";
  let rpcArguments: Record<string, unknown> | undefined;
  const client = {
    rpc: async (name: string, arguments_: Record<string, unknown>) => {
      rpcName = name;
      rpcArguments = arguments_;
      return { data: toRemoteSnapshot(snapshot), error: null };
    },
  } as unknown as SupabaseClient;

  const persisted = await replaceSupabaseFinancialSnapshot({
    client,
    householdId: "household",
    snapshot,
    revisionHash: "revision",
  });

  assert.equal(rpcName, "replace_financial_snapshot_v4");
  assert.equal(rpcArguments?.p_household_id, "household");
  assert.equal(rpcArguments?.p_revision_hash, "revision");
  assert.deepEqual(persisted, snapshot);
});

test("materializes a Class-A schedule through its narrow RPC, never snapshot replace", async () => {
  const scheduled = snapshotWithSchedule();
  let rpcName = "";
  let rpcArguments: Record<string, unknown> | undefined;
  const client = {
    rpc: async (name: string, arguments_: Record<string, unknown>) => {
      rpcName = name;
      rpcArguments = arguments_;
      return { data: { status: "applied", schedule_items: 3 }, error: null };
    },
  } as unknown as SupabaseClient;

  const result = await materializeSupabaseLegacyScheduleClassA({
    client,
    householdId: "household",
    installmentId: scheduled.installmentScheduleItems![0].installmentId,
    schedule: scheduled.installmentScheduleItems!,
  });

  assert.equal(rpcName, "materialize_legacy_installment_schedule_class_a");
  assert.equal(rpcArguments?.p_snapshot, undefined);
  assert.equal(
    rpcArguments?.p_installment_legacy_id,
    scheduled.installmentScheduleItems![0].installmentId,
  );
  assert.deepEqual(result, { status: "applied", scheduleItems: 3 });
});

test("transports an explicit schedule through replace V4", async () => {
  const scheduled = snapshotWithSchedule();
  let rpcSnapshot: unknown;
  const client = {
    rpc: async (_name: string, arguments_: Record<string, unknown>) => {
      rpcSnapshot = arguments_.p_snapshot;
      return { data: arguments_.p_snapshot, error: null };
    },
  } as unknown as SupabaseClient;

  const result = await replaceSupabaseFinancialSnapshot({
    client,
    householdId: "household",
    snapshot: scheduled,
    revisionHash: "schedule-revision",
  });

  assert.equal(
    (rpcSnapshot as RemoteSnapshot).installment_schedule_items?.length,
    3,
  );
  assert.deepEqual(
    result.installmentScheduleItems,
    scheduled.installmentScheduleItems,
  );
});

test("transports immutable settlement events through replace V4", async () => {
  const settled = snapshotWithSettlement();
  let rpcSnapshot: unknown;
  const client = {
    rpc: async (_name: string, arguments_: Record<string, unknown>) => {
      rpcSnapshot = arguments_.p_snapshot;
      return { data: arguments_.p_snapshot, error: null };
    },
  } as unknown as SupabaseClient;

  const result = await replaceSupabaseFinancialSnapshot({
    client,
    householdId: "household",
    snapshot: settled,
    revisionHash: "settlement-revision",
  });

  assert.equal(
    (rpcSnapshot as RemoteSnapshot).installment_settlement_events?.length,
    1,
  );
  assert.deepEqual(
    result.installmentSettlementEvents,
    settled.installmentSettlementEvents,
  );
});

test("preserves a sanitized V4 RPC error without exposing the snapshot or credentials", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: {
        code: "P0001",
        message: "persisted snapshot does not reconcile with source snapshot",
        details: 'payload {"income":13000,"access_token":"eyJ.secret.value"}',
        hint: "Retry only after inspecting the remote snapshot.",
        status: 400,
      },
    }),
  } as unknown as SupabaseClient;

  await assert.rejects(
    () =>
      replaceSupabaseFinancialSnapshot({
        client,
        householdId: "household",
        snapshot,
        revisionHash: "revision",
      }),
    (error: unknown) => {
      assert.ok(error instanceof SupabaseSnapshotWriteError);
      const diagnostic = remotePersistenceDiagnostic(error);
      assert.deepEqual(diagnostic, {
        stage: "replace_financial_snapshot_v4",
        function: "replaceSupabaseFinancialSnapshot",
        rpcStarted: true,
        rpcResponded: true,
        code: "P0001",
        message: "persisted snapshot does not reconcile with source snapshot",
        details: "Detalhe estruturado omitido.",
        hint: "Retry only after inspecting the remote snapshot.",
        status: 400,
      });
      assert.doesNotMatch(
        JSON.stringify(diagnostic),
        /income|access_token|eyJ/,
      );
      return true;
    },
  );
});

test("replaces a snapshot with an explicit removal before final reconciliation", async () => {
  const replacement: AppFinancialData = { ...snapshot, expenses: [] };
  let persisted = toRemoteSnapshot(snapshot);
  const client = {
    rpc: async (_name: string, arguments_: Record<string, unknown>) => {
      persisted = arguments_.p_snapshot as ReturnType<typeof toRemoteSnapshot>;
      return { data: persisted, error: null };
    },
  } as unknown as SupabaseClient;

  const result = await replaceSupabaseFinancialSnapshot({
    client,
    householdId: "household",
    snapshot: replacement,
    revisionHash: "removal-revision",
  });

  assert.equal(persisted.expenses.length, 0);
  assert.equal(result.expenses.length, 0);
  assert.deepEqual(result, replacement);

  const migration = readFileSync(
    "supabase/migrations/20260920105934_replace_financial_snapshot.sql",
    "utf8",
  );
  const validation = migration.indexOf("Validate the complete replacement");
  const staleExpenseDeletion = migration.indexOf(
    "delete from public.expenses current",
  );
  const delegatedImport = migration.indexOf(
    "v_result := public.import_financial_snapshot",
  );
  assert.ok(validation >= 0);
  assert.ok(staleExpenseDeletion > validation);
  assert.ok(delegatedImport > staleExpenseDeletion);
});

test("keeps the v1 reconciliation guardrail on a legacy projection in the v2 migration", () => {
  const migration = readFileSync(
    "supabase/migrations/20260923231716_import_v2_canonical_reconciliation.sql",
    "utf8",
  );
  assert.match(migration, /item\.value - 'invoice_reference_month'/);
  assert.match(
    migration,
    /p_snapshot - 'invoice_adjustments' - 'installment_invoice_events' - 'installment_reimbursement_allocations'/,
  );
  assert.match(
    migration,
    /public\.import_financial_snapshot\(p_household_id, p_source_hash, v_legacy_snapshot, p_summary\)/,
  );
  assert.match(
    migration,
    /public\.replace_financial_snapshot\(p_household_id, v_legacy_snapshot, p_revision_hash\)/,
  );
});

test("keeps the v3 category migration authorized and aligned with the legacy contract", () => {
  const migration = readFileSync(
    "supabase/migrations/20260924144301_dynamic_categories_foundation.sql",
    "utf8",
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on public\.financial_categories to authenticated;/,
  );
  assert.match(
    migration,
    /translate\(regexp_replace\(btrim\(name, ' '\), ' \+', ' ', 'g'\)/,
  );
  assert.match(
    migration,
    /encode\(convert_to\(canonical_name, 'UTF8'\), 'hex'\)/,
  );
  assert.match(migration, /foreign key \(household_id, category_legacy_id\)/);
  assert.match(migration, /replace_financial_snapshot_v3\(uuid,jsonb,text\)/);
  assert.match(
    migration,
    /import_financial_snapshot_v3\(uuid,text,jsonb,jsonb\)/,
  );
});

test("keeps the V4 budget migration aligned with its identity budget contract", () => {
  const migration = readFileSync(
    "supabase/migrations/20260925100000_category_budget_identity.sql",
    "utf8",
  );
  assert.match(migration, /jsonb_typeof\(entry\.value\) = 'number'/);
  assert.doesNotMatch(migration, /max\(amount\)/);
  assert.match(
    migration,
    /mapped\.budgets \|\| coalesce\(settings\.category_budgets, '\{\}'::jsonb\)/,
  );
  assert.match(migration, /replace_financial_snapshot_v4\(uuid,jsonb,text\)/);
  assert.match(
    migration,
    /import_financial_snapshot_v4\(uuid,text,jsonb,jsonb\)/,
  );
  assert.match(
    migration,
    /jsonb_set\(v_snapshot, '\{settings,category_budgets\}'/,
  );
  assert.match(
    migration,
    /current_setting\('brumath\.v4_snapshot_writer', true\) is distinct from 'enabled'/,
  );
  assert.match(
    migration,
    /replace_financial_snapshot_v3 is disabled after the V4 category-budget rollout/,
  );
  assert.match(
    migration,
    /import_financial_snapshot_v3 is disabled after the V4 category-budget rollout/,
  );
  assert.match(
    migration,
    /perform set_config\('brumath\.v4_snapshot_writer', 'enabled', true\);/,
  );
  assert.match(
    migration,
    /grant execute on function public\.replace_financial_snapshot_v4\(uuid,jsonb,text\) to authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.import_financial_snapshot_v4\(uuid,text,jsonb,jsonb\) to authenticated;/,
  );
});

test("keeps the V4 legacy writer projection migration aligned for replace and import", () => {
  const migration = readFileSync(
    "supabase/migrations/20260926120000_v4_category_budget_legacy_projection.sql",
    "utf8",
  );
  assert.match(
    migration,
    /v_snapshot_v3 := jsonb_set\(\s*p_snapshot,\s*'\{settings\}',\s*\(p_snapshot -> 'settings'\) - 'category_budgets'/,
  );
  assert.match(
    migration,
    /replace_financial_snapshot_v3\(\s*p_household_id,\s*v_snapshot_v3/,
  );
  assert.match(
    migration,
    /import_financial_snapshot_v3\(\s*p_household_id,\s*p_source_hash,\s*v_snapshot_v3/,
  );
  assert.match(
    migration,
    /jsonb_set\(v_result, '\{settings,category_budgets\}', v_category_budgets, true\)/,
  );
  assert.match(
    migration,
    /jsonb_set\(\s*v_snapshot,\s*'\{settings,category_budgets\}'/,
  );
  assert.match(
    migration,
    /grant execute on function public\.replace_financial_snapshot_v4\(uuid,jsonb,text\) to authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.import_financial_snapshot_v4\(uuid,text,jsonb,jsonb\) to authenticated;/,
  );
  assert.doesNotMatch(migration, /replace_financial_snapshot_v2\(/);
  assert.doesNotMatch(migration, /import_financial_snapshot_v2\(/);
});

test("guards the public V1 and V2 writers while preserving the V4 internal chain", () => {
  const migration = readFileSync(
    "supabase/migrations/20260926190553_legacy_writer_external_guard.sql",
    "utf8",
  );

  for (const writer of [
    "replace_financial_snapshot",
    "import_financial_snapshot",
    "replace_financial_snapshot_v2",
    "import_financial_snapshot_v2",
  ]) {
    assert.match(
      migration,
      new RegExp(`${writer} is disabled after the V4 category-budget rollout`),
    );
  }
  assert.match(
    migration,
    /current_setting\('brumath\.v4_snapshot_writer', true\) is distinct from 'enabled'/,
  );
  assert.match(migration, /create schema if not exists brumath_internal;/);
  assert.match(
    migration,
    /alter function public\.replace_financial_snapshot\(uuid, jsonb, text\)\s+rename to replace_financial_snapshot_v1_internal;/,
  );
  assert.match(
    migration,
    /brumath_internal\.replace_financial_snapshot_v2_internal\(/,
  );
  assert.match(
    migration,
    /brumath_internal\.import_financial_snapshot_v1_internal\(/,
  );
  assert.match(
    migration,
    /grant execute on function public\.replace_financial_snapshot_v2\(uuid, jsonb, text\) to authenticated;/,
  );
  assert.match(
    migration,
    /grant usage on schema brumath_internal to authenticated;/,
  );
  assert.match(
    migration,
    /grant usage on schema brumath_internal to service_role;/,
  );
  assert.match(
    migration,
    /revoke all on function public\.import_financial_snapshot_v2\(uuid, text, jsonb, jsonb\) from anon;/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.replace_financial_snapshot\(uuid, jsonb, text\) to anon;/,
  );
});

test("defines an additive household-isolated installment schedule foundation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260927110000_installment_schedule_foundation.sql",
    "utf8",
  );
  assert.match(migration, /create table public\.installment_schedule_items/i);
  assert.match(migration, /foreign key \(household_id, installment_id\)/i);
  assert.match(migration, /foreign key \(household_id, credit_card_id\)/i);
  assert.match(
    migration,
    /unique \(household_id, installment_id, installment_number\)/i,
  );
  assert.match(migration, /enable row level security/i);
  assert.match(
    migration,
    /revoke all on table public\.installment_schedule_items from anon/i,
  );
  assert.doesNotMatch(
    migration,
    /insert into public\.installment_schedule_items/i,
  );
});

test("keeps the V4 installment schedule outside the legacy projection and inside reconciliation", () => {
  const migration = readFileSync(
    "supabase/migrations/20260927120000_v4_installment_schedule_snapshot.sql",
    "utf8",
  );

  assert.match(
    migration,
    /v_schedule_provided boolean := p_snapshot \? 'installment_schedule_items'/,
  );
  assert.match(
    migration,
    /if v_schedule_provided then[\s\S]*delete from public\.installment_schedule_items current/,
  );
  assert.match(migration, /p_snapshot - 'installment_schedule_items'/);
  assert.match(migration, /insert into public\.installment_schedule_items\(/);
  assert.match(
    migration,
    /order by installment\.legacy_id, item\.installment_number, item\.legacy_id/,
  );
  assert.match(
    migration,
    /v_schedule_source is distinct from v_schedule_readback/,
  );
  assert.match(
    migration,
    /raise exception 'persisted snapshot does not reconcile with source snapshot'/,
  );
  assert.match(
    migration,
    /create or replace function public\.replace_financial_snapshot_v4\(\s*p_household_id uuid, p_snapshot jsonb, p_revision_hash text/,
  );
  assert.match(
    migration,
    /create or replace function public\.import_financial_snapshot_v4\(\s*p_household_id uuid, p_source_hash text, p_snapshot jsonb, p_summary jsonb/,
  );
  assert.match(
    migration,
    /public\.replace_financial_snapshot_v3\(\s*p_household_id,\s*v_snapshot_v3/,
  );
  assert.match(
    migration,
    /public\.import_financial_snapshot_v3\(\s*p_household_id,\s*p_source_hash,\s*v_snapshot_v3/,
  );
  assert.match(
    migration,
    /perform set_config\('brumath\.v4_snapshot_writer', 'enabled', true\);/,
  );
  assert.match(
    migration,
    /grant execute on function public\.replace_financial_snapshot_v4\(uuid,jsonb,text\) to authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.import_financial_snapshot_v4\(uuid,text,jsonb,jsonb\) to authenticated;/,
  );
  assert.doesNotMatch(migration, /grant .* to anon/i);
});

test("defines cancelled schedule rows as a V4-only authoritative lifecycle state", () => {
  const migration = readFileSync(
    "supabase/migrations/20260929110000_installment_schedule_cancelled_lifecycle.sql",
    "utf8",
  );
  assert.match(migration, /status in \('scheduled', 'cancelled'\)/i);
  assert.match(migration, /status' not in \('scheduled', 'cancelled'\)/i);
  assert.match(migration, /replace_financial_snapshot_v4/i);
  assert.match(migration, /import_financial_snapshot_v4/i);
});

test("defines immutable household-isolated settlement facts as a V4 extension", () => {
  const migration = readFileSync(
    "supabase/migrations/20260927130000_installment_settlement_events.sql",
    "utf8",
  );

  assert.match(
    migration,
    /create table public\.installment_settlement_events/i,
  );
  assert.match(
    migration,
    /foreign key \([\s\S]*household_id,[\s\S]*installment_schedule_item_id,[\s\S]*installment_id,[\s\S]*installment_number[\s\S]*\)[\s\S]*references public\.installment_schedule_items/i,
  );
  assert.match(
    migration,
    /unique \(household_id, installment_schedule_item_id\)/i,
  );
  assert.match(migration, /on delete restrict/i);
  assert.match(migration, /enable row level security/i);
  assert.match(
    migration,
    /for insert to authenticated[\s\S]*with check \([\s\S]*public\.is_household_member\(household_id\)/i,
  );
  assert.match(
    migration,
    /schedule\.amount = installment_settlement_events\.amount/i,
  );
  assert.match(
    migration,
    /grant select, insert on table public\.installment_settlement_events to authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant .*installment_settlement_events.* to anon/i,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:update|delete).*installment_settlement_events.*authenticated/i,
  );
  assert.match(
    migration,
    /p_snapshot - 'installment_schedule_items' - 'installment_settlement_events'/,
  );
  assert.match(
    migration,
    /snapshot cannot remove an immutable settlement event/,
  );
  assert.match(
    migration,
    /snapshot cannot rewrite an immutable settlement event/,
  );
  assert.match(migration, /snapshot cannot rewrite a settled schedule item/);
  assert.match(
    migration,
    /v_settlements_source is distinct from v_settlements_readback/,
  );
  assert.match(
    migration,
    /v_settlements_provided boolean := p_snapshot \? 'installment_settlement_events'/,
  );
  assert.doesNotMatch(
    migration,
    /delete from public\.installment_settlement_events/i,
  );
  assert.match(
    migration,
    /replace_financial_snapshot_v4\(uuid,jsonb,text\) to authenticated/,
  );
  assert.match(
    migration,
    /import_financial_snapshot_v4\(uuid,text,jsonb,jsonb\) to authenticated/,
  );
});

test("hardens schedule and immutable settlement table grants explicitly", () => {
  const migration = readFileSync(
    "supabase/migrations/20260928190000_installment_schedule_settlement_grants_hardening.sql",
    "utf8",
  );

  for (const table of [
    "installment_schedule_items",
    "installment_settlement_events",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from public;`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from anon;`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from authenticated;`,
        "i",
      ),
    );
  }

  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.installment_schedule_items to authenticated;/i,
  );
  assert.match(
    migration,
    /grant select, insert on table public\.installment_settlement_events to authenticated;/i,
  );
  assert.doesNotMatch(
    migration,
    /grant .*\b(?:update|delete|truncate|references|trigger)\b.*installment_settlement_events.*authenticated/i,
  );
});

test("defines a locked, narrow Class-A schedule materialization RPC", () => {
  const migration = readFileSync(
    "supabase/migrations/20260930120000_legacy_schedule_materialization_rpc.sql",
    "utf8",
  );
  assert.match(
    migration,
    /materialize_legacy_installment_schedule_class_a\([\s\S]*p_household_id uuid,[\s\S]*p_installment_legacy_id bigint,[\s\S]*p_schedule jsonb/,
  );
  assert.match(migration, /security invoker/);
  assert.match(migration, /for update/);
  assert.match(migration, /schedule_exists/);
  assert.match(migration, /schedule conflicts with an invoice event/);
  assert.match(migration, /schedule conflicts with a settlement event/);
  assert.match(migration, /schedule conflicts with a protected reimbursement/);
  assert.match(
    migration,
    /revoke all on function public\.materialize_legacy_installment_schedule_class_a[\s\S]*from public/,
  );
  assert.match(
    migration,
    /grant execute on function public\.materialize_legacy_installment_schedule_class_a[\s\S]*to authenticated/,
  );
});

test("moves schedule writes behind authenticated V4 and Class-A RPC boundaries", () => {
  const migration = readFileSync(
    "supabase/migrations/20260930130000_v4_schedule_write_boundary.sql",
    "utf8",
  );

  assert.match(
    migration,
    /replace_financial_snapshot_v4_internal[\s\S]*set schema brumath_internal/i,
  );
  assert.match(
    migration,
    /import_financial_snapshot_v4_internal[\s\S]*set schema brumath_internal/i,
  );
  assert.match(
    migration,
    /create function public\.replace_financial_snapshot_v4[\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  assert.match(
    migration,
    /create function public\.import_financial_snapshot_v4[\s\S]*security definer[\s\S]*set search_path = ''/i,
  );
  assert.match(
    migration,
    /auth\.uid\(\) is null[\s\S]*household membership is required/i,
  );
  assert.match(
    migration,
    /materialize_legacy_installment_schedule_class_a[\s\S]*security definer/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.installment_schedule_items from authenticated;/i,
  );
  assert.match(
    migration,
    /grant select on table public\.installment_schedule_items to authenticated;/i,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:select\s*,\s*)?(?:insert|update|delete)[^;]*on table public\.installment_schedule_items to authenticated/i,
  );
  for (const functionName of [
    "replace_financial_snapshot_v4",
    "import_financial_snapshot_v4",
    "materialize_legacy_installment_schedule_class_a",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${functionName}[\\s\\S]*from public`,
        "i",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${functionName}[\\s\\S]*from anon`,
        "i",
      ),
    );
  }
});

test("bootstraps only through the authenticated household RPC", async () => {
  let rpcName = "";
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    },
    rpc: async (name: string) => {
      rpcName = name;
      return { data: "household", error: null };
    },
  } as unknown as SupabaseClient;

  assert.equal(await bootstrapFinancialHousehold(client), "household");
  assert.equal(rpcName, "bootstrap_financial_household");
});
