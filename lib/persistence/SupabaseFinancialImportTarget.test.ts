import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppFinancialData } from "../app/AppTypes";
import {
  fromRemoteSnapshot,
  replaceSupabaseFinancialSnapshot,
  SupabaseFinancialImportTarget,
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
  });
  assert.deepEqual(fromRemoteSnapshot(remote), snapshot);
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

  assert.equal(rpcName, "import_financial_snapshot");
  assert.equal(rpcArguments?.p_household_id, "household");
  assert.equal(rpcArguments?.p_source_hash, "hash");
  assert.deepEqual(persisted, snapshot);
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

  assert.equal(rpcName, "replace_financial_snapshot");
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
    "supabase/migrations/20260920102209_replace_financial_snapshot.sql",
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
