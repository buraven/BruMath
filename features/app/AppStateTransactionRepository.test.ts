import assert from "node:assert/strict";
import test from "node:test";
import { AppStateTransactionRepository } from "./AppStateTransactionRepository";

test("assistant transaction adapter updates the shared expense snapshot without storage access", async () => {
  let expenses = [] as {
    id: number;
    title: string;
    cat: string;
    who: "Bruna" | "Matheus" | "Casal";
    amount: number;
    date: string;
  }[];
  const setExpenses = (
    value: typeof expenses | ((current: typeof expenses) => typeof expenses),
  ) => {
    expenses = typeof value === "function" ? value(expenses) : value;
  };

  const repository = new AppStateTransactionRepository(setExpenses);
  await repository.save({
    id: "expense:12",
    description: "Mercado",
    amount: 85,
    category: "Alimentação",
    owner: "Bruna",
    type: "expense",
    date: "2026-09-10",
  });

  assert.deepEqual(expenses, [
    {
      id: 12,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna",
      amount: 85,
      date: "2026-09-10",
    },
  ]);
});
