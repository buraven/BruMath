import { describe, expect, it } from "vitest";
import type { Transaction } from "./transactions";
import type { TransactionRepository } from "./TransactionRepository";
import { getLimitUsages } from "./limitsService";

const transactions: Transaction[] = [
  {
    id: "1",
    description: "Delivery",
    amount: 120,
    category: "Delivery",
    owner: "Casal",
    type: "expense",
    date: "2026-08-01",
  },
  {
    id: "2",
    description: "Gasto da Bru",
    amount: 80,
    category: "Comprinhas",
    owner: "Bruna",
    type: "expense",
    date: "2026-08-02",
  },
  {
    id: "3",
    description: "Salário",
    amount: 13000,
    category: "Salário",
    owner: "Bruna",
    type: "income",
    date: "2026-08-27",
  },
];

const repository: TransactionRepository = {
  getAll: async () => transactions,
  getById: async () => null,
  save: async () => undefined,
  update: async () => undefined,
  delete: async () => undefined,
};

describe("getLimitUsages", () => {
  it("uses real expenses and ignores income", async () => {
    const limits = [
      { id: "delivery", label: "Delivery", owner: "Casal", amount: 200 },
      { id: "gastos-bruna", label: "Gastos da Bru", owner: "Bruna", amount: 350 },
    ];

    const usages = await getLimitUsages(repository, limits);

    expect(usages).toEqual([
      expect.objectContaining({ spent: 120, limit: 200, remaining: 80 }),
      expect.objectContaining({ spent: 80, limit: 350, remaining: 270 }),
    ]);
  });
});
