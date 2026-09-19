import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_E2E_USER_A_EMAIL",
  "SUPABASE_E2E_USER_A_PASSWORD",
  "SUPABASE_E2E_USER_B_EMAIL",
  "SUPABASE_E2E_USER_B_PASSWORD",
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  return value;
}

function fixture(ids) {
  return {
    settings: {
      income: 5000,
      budgets: { Alimentação: 700 },
      limits: { Bruna: 350, Matheus: 350 },
      personal_limits: {
        bruna_nails: 150,
        bruna_personal: 350,
        matheus_personal: 350,
      },
      active_profile: "Bruna",
      view_month: "2030-01-01",
    },
    expenses: [
      {
        legacy_id: ids.expense,
        title: "Mercado sintético",
        category: "Alimentação",
        responsible: "Bruna",
        amount: 123.45,
        occurred_on: "2030-01-10",
        personal_limit_bucket: null,
        credit_card_legacy_id: ids.card,
      },
    ],
    installments: [],
    receivables: [
      {
        legacy_id: ids.receivable,
        person: "Test User",
        amount: 40,
        paid: 0,
        destination: "bruna",
        note: "Recebível sintético",
        competence_month: "2030-01-01",
        received_month: null,
      },
    ],
    income_entries: [],
    credit_cards: [
      {
        legacy_id: ids.card,
        name: "Test Card",
        issuer: "Synthetic",
        owner: "Bruna",
        credit_limit: 1000,
        closing_day: 20,
        due_day: 27,
        appearance: "blue",
        active: true,
      },
    ],
    invoice_payments: [],
  };
}

function resultSummary(results) {
  return {
    status: results.every((result) => result.status === "PASS")
      ? "PASS"
      : "FAIL",
    scenarios: results,
  };
}

async function restoreSyntheticRun(client, householdId, ids, hashes, settings) {
  const deleteRows = async (table, legacyIds) => {
    if (!legacyIds.length) return;
    const result = await client
      .from(table)
      .delete()
      .eq("household_id", householdId)
      .in("legacy_id", legacyIds);
    assert.equal(result.error, null);
  };

  await deleteRows("invoice_payments", ids.invoicePayments);
  await deleteRows("expenses", [ids.expense, ids.invalidExpense]);
  await deleteRows("installments", ids.installments);
  await deleteRows("receivables", [ids.receivable]);
  await deleteRows("income_entries", ids.incomeEntries);
  await deleteRows("credit_cards", [ids.card]);
  const imports = await client
    .from("local_imports")
    .delete()
    .eq("household_id", householdId)
    .in("source_hash", hashes);
  assert.equal(imports.error, null);
  const restored = await client
    .from("financial_settings")
    .update(settings)
    .eq("household_id", householdId);
  assert.equal(restored.error, null);
}

export async function runSupabaseSyntheticE2E(environment = process.env) {
  if (required.some((name) => !environment[name])) {
    return {
      status: "FAIL",
      scenarios: [{ name: "configuração protegida", status: "FAIL" }],
    };
  }
  const createAuthenticatedClient = async (email, password) => {
    const client = createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const result = await client.auth.signInWithPassword({ email, password });
    assert.equal(result.error, null);
    assert.ok(result.data.user);
    return { client, user: result.data.user };
  };
  const bootstrap = async (client) => {
    const result = await client.rpc("bootstrap_financial_household");
    assert.equal(result.error, null);
    assert.ok(result.data);
    return result.data;
  };
  const importSnapshot = (client, householdId, hash, snapshot) =>
    client.rpc("import_financial_snapshot", {
      p_household_id: householdId,
      p_source_hash: hash,
      p_snapshot: snapshot,
      p_summary: {
        expenses: snapshot.expenses.length,
        installments: snapshot.installments.length,
        receivables: snapshot.receivables.length,
        incomeEntries: snapshot.income_entries.length,
        creditCards: snapshot.credit_cards.length,
        invoicePayments: snapshot.invoice_payments.length,
      },
    });
  const results = [];
  const scenario = async (name, run) => {
    try {
      await run();
      results.push({ name, status: "PASS" });
      return true;
    } catch {
      results.push({ name, status: "FAIL" });
      return false;
    }
  };

  const runId = randomUUID();
  const baseId = randomInt(100000000, 1500000000);
  const ids = {
    expense: baseId,
    card: baseId + 1,
    receivable: baseId + 2,
    invalidExpense: baseId + 3,
    installments: [],
    incomeEntries: [],
    invoicePayments: [],
  };
  const sourceHash = `brumath-synthetic-${runId}`;
  const invalidSourceHash = `${sourceHash}-invalid`;
  const crossHouseholdHash = `${sourceHash}-cross-household`;
  let a;
  let b;
  let householdA;
  let householdB;
  let originalSettings;
  try {
    let proceed = await scenario("autenticação sintética A e B", async () => {
      a = await createAuthenticatedClient(
        environment.SUPABASE_E2E_USER_A_EMAIL,
        environment.SUPABASE_E2E_USER_A_PASSWORD,
      );
      b = await createAuthenticatedClient(
        environment.SUPABASE_E2E_USER_B_EMAIL,
        environment.SUPABASE_E2E_USER_B_PASSWORD,
      );
    });
    if (proceed)
      proceed = await scenario(
        "bootstrap idempotente e ownership próprio",
        async () => {
          householdA = await bootstrap(a.client);
          assert.equal(await bootstrap(a.client), householdA);
          householdB = await bootstrap(b.client);
          assert.notEqual(householdA, householdB);
          const settings = await a.client
            .from("financial_settings")
            .select(
              "income, budgets, limits, personal_limits, active_profile, view_month",
            )
            .eq("household_id", householdA)
            .single();
          assert.equal(settings.error, null);
          originalSettings = settings.data;
        },
      );

    const snapshot = fixture(ids);
    if (proceed)
      proceed = await scenario(
        "importação e reconciliação sintéticas",
        async () => {
          const imported = await importSnapshot(
            a.client,
            householdA,
            sourceHash,
            snapshot,
          );
          assert.equal(imported.error, null);
          assert.equal(imported.data.imported, true);
          assert.deepEqual(
            canonicalize(imported.data.snapshot),
            canonicalize(snapshot),
          );
        },
      );
    if (proceed)
      proceed = await scenario(
        "idempotência e leitura do próprio household",
        async () => {
          const repeated = await importSnapshot(
            a.client,
            householdA,
            sourceHash,
            snapshot,
          );
          assert.equal(repeated.error, null);
          assert.equal(repeated.data.imported, false);
          const expenses = await a.client
            .from("expenses")
            .select("legacy_id, amount")
            .eq("household_id", householdA)
            .eq("legacy_id", ids.expense);
          assert.equal(expenses.error, null);
          assert.equal(expenses.data.length, 1);
          assert.equal(expenses.data[0].legacy_id, ids.expense);
          assert.equal(Number(expenses.data[0].amount), 123.45);
        },
      );
    if (proceed)
      proceed = await scenario(
        "RLS bloqueia acesso cross-household",
        async () => {
          const readOther = await b.client
            .from("expenses")
            .select("legacy_id")
            .eq("household_id", householdA);
          assert.equal(readOther.error, null);
          assert.deepEqual(readOther.data, []);
          const writeOther = await b.client.from("expenses").insert({
            household_id: householdA,
            legacy_id: 99001,
            title: "Tentativa sintética",
            category: "Outros",
            responsible: "Matheus",
            amount: 1,
            occurred_on: "2030-01-11",
          });
          assert.ok(writeOther.error);
          const importOther = await importSnapshot(
            b.client,
            householdA,
            crossHouseholdHash,
            snapshot,
          );
          assert.ok(importOther.error);
          const addMembership = await b.client
            .from("household_members")
            .insert({
              household_id: householdA,
              user_id: b.user.id,
              role: "owner",
            });
          assert.ok(addMembership.error);
          await b.client
            .from("households")
            .update({ owner_id: b.user.id })
            .eq("id", householdA);
          const ownerAfterAttack = await a.client
            .from("households")
            .select("owner_id")
            .eq("id", householdA)
            .single();
          assert.equal(ownerAfterAttack.error, null);
          assert.equal(ownerAfterAttack.data.owner_id, a.user.id);
        },
      );
    if (proceed)
      await scenario("rollback de snapshot inválido", async () => {
        const invalid = structuredClone(snapshot);
        invalid.expenses[0].legacy_id = ids.invalidExpense;
        invalid.expenses[0].credit_card_legacy_id = 999999;
        const rejected = await importSnapshot(
          a.client,
          householdA,
          invalidSourceHash,
          invalid,
        );
        assert.ok(rejected.error);
        const partialExpense = await a.client
          .from("expenses")
          .select("legacy_id")
          .eq("household_id", householdA)
          .eq("legacy_id", ids.invalidExpense);
        assert.deepEqual(partialExpense.data, []);
        const partialMark = await a.client
          .from("local_imports")
          .select("id")
          .eq("household_id", householdA)
          .eq("source_hash", invalidSourceHash);
        assert.deepEqual(partialMark.data, []);
      });
  } finally {
    if (a && householdA && originalSettings) {
      const cleaned = await scenario("cleanup sintético", () =>
        restoreSyntheticRun(
          a.client,
          householdA,
          ids,
          [sourceHash, invalidSourceHash, crossHouseholdHash],
          originalSettings,
        ),
      );
      if (!cleaned) return resultSummary(results);
    }
  }
  return resultSummary(results);
}
