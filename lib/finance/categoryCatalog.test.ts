import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalCategoryDisplayName,
  hydrateCategoryCatalog,
  legacyCategoryId,
  normalizeCategoryName,
} from "./categoryCatalog";

const legacy = {
  expenses: [
    {
      id: 1,
      title: "Mercado",
      cat: "  Alimentação ",
      who: "Casal" as const,
      amount: 50,
      date: "2026-09-01",
    },
    {
      id: 2,
      title: "Histórico",
      cat: "Acervo antigo",
      who: "Bruna" as const,
      amount: 25,
      date: "2026-09-02",
    },
  ],
  installments: [
    {
      id: 3,
      title: "Ônibus",
      category: "Transporte",
      who: "Matheus" as const,
      amount: 10,
      totalInstallments: 2,
      paidInstallments: 0,
      nextDue: "2026-10-01",
    },
  ],
  budgets: { Alimentação: 400, Transporte: 80 },
};

test("bootstraps stable legacy categories from facts, budgets and defaults", () => {
  const hydrated = hydrateCategoryCatalog(legacy);
  assert.equal(
    hydrated.categories.filter((item) => item.name === "Alimentação").length,
    1,
  );
  assert.ok(hydrated.categories.some((item) => item.name === "Transporte"));
  assert.ok(hydrated.categories.some((item) => item.name === "Acervo antigo"));
  assert.equal(
    hydrated.expenses[0]?.categoryId,
    legacyCategoryId("Alimentação"),
  );
  assert.equal(
    hydrated.installments[0]?.categoryId,
    legacyCategoryId("Transporte"),
  );
  assert.deepEqual(hydrated.budgets, legacy.budgets);
  assert.equal(
    hydrated.expenses.reduce((total, expense) => total + expense.amount, 0) +
      hydrated.installments.reduce(
        (total, installment) => total + installment.amount,
        0,
      ),
    legacy.expenses.reduce((total, expense) => total + expense.amount, 0) +
      legacy.installments.reduce(
        (total, installment) => total + installment.amount,
        0,
      ),
  );
  assert.deepEqual(hydrateCategoryCatalog(hydrated), hydrated);
});

test("uses one deterministic legacy normalization and display contract", () => {
  assert.equal(normalizeCategoryName("Alimentação"), "alimentação");
  assert.equal(normalizeCategoryName(" alimentação "), "alimentação");
  assert.equal(normalizeCategoryName("ALIMENTAÇÃO"), "alimentação");
  assert.equal(normalizeCategoryName("Casa   Nova"), "casa nova");
  assert.equal(normalizeCategoryName("CASA NOVA"), "casa nova");
  assert.equal(normalizeCategoryName(" transporte "), "transporte");
  assert.equal(canonicalCategoryDisplayName("  Casa   Nova "), "Casa Nova");
  assert.equal(legacyCategoryId(" ALIMENTAÇÃO "), "legacy:alimentação");
  assert.notEqual(
    normalizeCategoryName("Saúde"),
    normalizeCategoryName("Saude"),
  );
  const legacyVariants = hydrateCategoryCatalog({
    expenses: [
      {
        id: 4,
        title: "A",
        cat: "CASA NOVA",
        who: "Casal" as const,
        amount: 1,
        date: "2026-09-01",
      },
      {
        id: 5,
        title: "B",
        cat: " Casa   Nova ",
        who: "Casal" as const,
        amount: 1,
        date: "2026-09-02",
      },
    ],
    installments: [],
    budgets: {},
  });
  const casaNova = legacyVariants.categories.find(
    (item) => item.id === "legacy:casa nova",
  );
  assert.equal(casaNova?.name, "CASA NOVA");
  assert.equal(legacyVariants.expenses[0]?.categoryId, "legacy:casa nova");
  assert.equal(legacyVariants.expenses[1]?.categoryId, "legacy:casa nova");
});

test("keeps materialized archived and active categories separate by identity", () => {
  const hydrated = hydrateCategoryCatalog({
    ...legacy,
    categories: [
      { id: "food-archive", name: "Alimentação", active: false, sortOrder: 1 },
      { id: "food-active", name: " alimentação ", active: true, sortOrder: 2 },
    ],
    expenses: [{ ...legacy.expenses[0]!, categoryId: "food-archive" }],
    installments: [
      {
        ...legacy.installments[0]!,
        category: "Alimentação",
        categoryId: "food-archive",
      },
    ],
  });
  assert.deepEqual(
    hydrated.categories.filter((item) => item.id.startsWith("food-")),
    [
      { id: "food-archive", name: "Alimentação", active: false, sortOrder: 1 },
      { id: "food-active", name: "alimentação", active: true, sortOrder: 2 },
    ],
  );
  assert.equal(hydrated.expenses[0]?.categoryId, "food-archive");
  assert.equal(hydrated.installments[0]?.categoryId, "food-archive");
  assert.deepEqual(hydrateCategoryCatalog(hydrated), hydrated);
});

test("archived category remains attached to historical facts", () => {
  const hydrated = hydrateCategoryCatalog({
    ...legacy,
    categories: [
      { id: "historic", name: "Acervo antigo", active: false, sortOrder: 8 },
    ],
  });
  assert.equal(hydrated.expenses[1]?.categoryId, "historic");
  assert.equal(
    hydrated.categories.find((item) => item.id === "historic")?.active,
    false,
  );
});
