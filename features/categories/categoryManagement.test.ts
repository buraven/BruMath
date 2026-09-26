import assert from "node:assert/strict";
import test from "node:test";
import {
  createManagedCategory,
  categoryHasHistory,
  assertCategoryCanBeDeleted,
} from "./categoryManagement";

test("new categories have independent stable IDs and reject active normalized duplicates", () => {
  const category = createManagedCategory([], " Alimentação ", "category-1");
  assert.equal(category.id, "category-1");
  assert.equal(category.name, "Alimentação");
  assert.throws(() =>
    createManagedCategory([category], "ALIMENTAÇÃO", "category-2"),
  );
});

test("direct deletion guard rejects a category with historical references", () => {
  const category = {
    id: "category-1",
    name: "Comida",
    active: true,
    sortOrder: 0,
  };
  assert.throws(() =>
    assertCategoryCanBeDeleted(category, {
      expenses: [{ id: 1, categoryId: "category-1" } as any],
      installments: [],
      categoryBudgets: {},
    }),
  );
});

test("history and category budgets block permanent deletion", () => {
  const category = {
    id: "category-1",
    name: "Comida",
    active: false,
    sortOrder: 0,
  };
  assert.equal(
    categoryHasHistory(category, {
      expenses: [{ id: 1, categoryId: "category-1" } as any],
      installments: [],
      categoryBudgets: {},
    }),
    true,
  );
  assert.equal(
    categoryHasHistory(category, {
      expenses: [],
      installments: [],
      categoryBudgets: { "category-1": 1400 },
    }),
    true,
  );
});

test("legacy textual facts still protect their renamed legacy category", () => {
  const category = {
    id: "legacy:alimentação",
    name: "Comida",
    active: true,
    sortOrder: 0,
  };
  assert.throws(() =>
    assertCategoryCanBeDeleted(category, {
      expenses: [{ id: 1, cat: "Alimentação" } as any],
      installments: [],
      categoryBudgets: {},
    }),
  );
});
