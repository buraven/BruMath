import assert from "node:assert/strict";
import test from "node:test";
import {
  orderedActiveCategories,
  searchCategories,
} from "./categorySelectorHelpers";

const categories = [
  { id: "archived", name: "Arquivo", active: false, sortOrder: 0 },
  { id: "food", name: "Alimentação", active: true, sortOrder: 2 },
  { id: "car", name: "Carro", active: true, sortOrder: 1 },
  { id: "house", name: "Casa Nova", active: true, sortOrder: 2 },
] as const;

test("category selector lists only active categories in catalog order", () => {
  assert.deepEqual(
    orderedActiveCategories(categories).map((category) => category.id),
    ["car", "food", "house"],
  );
});

test("category selector search ignores case and surrounding or repeated spaces", () => {
  assert.deepEqual(
    searchCategories(categories, " ALI ").map((category) => category.id),
    ["food"],
  );
  assert.deepEqual(
    searchCategories(categories, "Casa   ").map((category) => category.id),
    ["house"],
  );
  assert.deepEqual(searchCategories(categories, "nada"), []);
});
