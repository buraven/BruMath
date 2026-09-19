import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_E2E_USER_A_EMAIL",
  "SUPABASE_E2E_USER_A_PASSWORD",
  "SUPABASE_E2E_USER_B_EMAIL",
  "SUPABASE_E2E_USER_B_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(
    `O harness Supabase exige variáveis locais/CI para duas contas sintéticas: ${missing.join(", ")}.`,
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sourceHash = "brumath-synthetic-supabase-e2e-v1";
const invalidSourceHash = "brumath-synthetic-supabase-e2e-invalid-v1";

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedClient(email, password) {
  const instance = client();
  const result = await instance.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user)
    throw new Error("A autenticação de uma conta sintética falhou.");
  return { client: instance, user: result.data.user };
}

function snapshot() {
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
        legacy_id: 90001,
        title: "Mercado sintético",
        category: "Alimentação",
        responsible: "Bruna",
        amount: 123.45,
        occurred_on: "2030-01-10",
        personal_limit_bucket: null,
        credit_card_legacy_id: 91001,
      },
    ],
    installments: [],
    receivables: [
      {
        legacy_id: 92001,
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
        legacy_id: 91001,
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

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function bootstrap(instance) {
  const result = await instance.rpc("bootstrap_financial_household");
  if (result.error || !result.data)
    throw new Error("O bootstrap remoto falhou.");
  return result.data;
}

async function importSnapshot(instance, householdId, hash, value) {
  return instance.rpc("import_financial_snapshot", {
    p_household_id: householdId,
    p_source_hash: hash,
    p_snapshot: value,
    p_summary: {
      expenses: value.expenses.length,
      installments: value.installments.length,
      receivables: value.receivables.length,
      incomeEntries: value.income_entries.length,
      creditCards: value.credit_cards.length,
      invoicePayments: value.invoice_payments.length,
    },
  });
}

const a = await authenticatedClient(
  process.env.SUPABASE_E2E_USER_A_EMAIL,
  process.env.SUPABASE_E2E_USER_A_PASSWORD,
);
const b = await authenticatedClient(
  process.env.SUPABASE_E2E_USER_B_EMAIL,
  process.env.SUPABASE_E2E_USER_B_PASSWORD,
);
const householdA = await bootstrap(a.client);
assert.equal(
  await bootstrap(a.client),
  householdA,
  "bootstrap A precisa ser idempotente",
);
const householdB = await bootstrap(b.client);
assert.notEqual(householdA, householdB, "cada usuário recebe seu household");

const fixture = snapshot();
const firstImport = await importSnapshot(
  a.client,
  householdA,
  sourceHash,
  fixture,
);
assert.equal(firstImport.error, null, firstImport.error?.message);
assert.equal(firstImport.data.imported, true);
assert.ok(
  sameJson(firstImport.data.snapshot, fixture),
  "snapshot retornado precisa reconciliar",
);

const secondImport = await importSnapshot(
  a.client,
  householdA,
  sourceHash,
  fixture,
);
assert.equal(secondImport.error, null, secondImport.error?.message);
assert.equal(
  secondImport.data.imported,
  false,
  "reimportação não pode duplicar dados",
);
const ownExpenses = await a.client
  .from("expenses")
  .select("legacy_id, amount")
  .eq("household_id", householdA)
  .eq("legacy_id", 90001);
assert.equal(ownExpenses.error, null);
assert.equal(ownExpenses.data.length, 1);
assert.equal(ownExpenses.data[0].legacy_id, 90001);
assert.equal(Number(ownExpenses.data[0].amount), 123.45);

const readOther = await b.client
  .from("expenses")
  .select("legacy_id")
  .eq("household_id", householdA);
assert.equal(readOther.error, null);
assert.deepEqual(readOther.data, [], "B não pode ler os dados de A");
const writeOther = await b.client.from("expenses").insert({
  household_id: householdA,
  legacy_id: 99001,
  title: "Tentativa sintética",
  category: "Outros",
  responsible: "Matheus",
  amount: 1,
  occurred_on: "2030-01-11",
});
assert.ok(writeOther.error, "B não pode escrever dados no household de A");
const importOther = await importSnapshot(
  b.client,
  householdA,
  "brumath-cross-household",
  fixture,
);
assert.ok(importOther.error, "B não pode importar para o household de A");
const addMembership = await b.client.from("household_members").insert({
  household_id: householdA,
  user_id: b.user.id,
  role: "owner",
});
assert.ok(addMembership.error, "B não pode se adicionar ao household de A");
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
assert.equal(
  ownerAfterAttack.data.owner_id,
  a.user.id,
  "B não pode tomar ownership de A",
);

const invalid = structuredClone(fixture);
invalid.expenses[0].legacy_id = 99002;
invalid.expenses[0].credit_card_legacy_id = 999999;
const rejectedImport = await importSnapshot(
  a.client,
  householdA,
  invalidSourceHash,
  invalid,
);
assert.ok(rejectedImport.error, "snapshot inválido precisa falhar");
const partialExpense = await a.client
  .from("expenses")
  .select("legacy_id")
  .eq("household_id", householdA)
  .eq("legacy_id", 99002);
assert.deepEqual(
  partialExpense.data,
  [],
  "falha não pode deixar escrita parcial",
);
const partialMark = await a.client
  .from("local_imports")
  .select("id")
  .eq("household_id", householdA)
  .eq("source_hash", invalidSourceHash);
assert.deepEqual(partialMark.data, [], "falha não pode marcar a importação");

console.log(
  "Supabase E2E sintético: passou (A/B, RLS, importação, idempotência e rollback).",
);
