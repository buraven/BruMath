import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppFinancialData } from "../app/AppTypes";
import {
  fromRemoteSnapshot,
  normalizePersistedFinancialSnapshot,
  replaceSupabaseFinancialSnapshot,
  simulateImportV2RoundTrip,
  SupabaseImportRpcError,
  SupabaseFinancialImportTarget,
  toLegacyImportSnapshot,
  toRemoteSnapshot,
} from "./SupabaseFinancialImportTarget";
import { bootstrapFinancialHousehold } from "./supabaseAuth";

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

  assert.equal(rpcName, "import_financial_snapshot_v3");
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

test("preserves sanitized RPC metadata instead of replacing it with a generic error", async () => {
  const client = {
    rpc: async () => ({
      data: null,
      error: {
        code: "42883",
        message: "function public.import_financial_snapshot_v3 does not exist",
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
        stage: "import_financial_snapshot_v3",
        function: "SupabaseFinancialImportTarget.importAtomically",
        rpcStarted: true,
        rpcResponded: true,
        code: "42883",
        message: "function public.import_financial_snapshot_v3 does not exist",
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

  assert.equal(rpcName, "replace_financial_snapshot_v3");
  assert.equal(rpcArguments?.p_household_id, "household");
  assert.equal(rpcArguments?.p_revision_hash, "revision");
  assert.deepEqual(persisted, snapshot);
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
