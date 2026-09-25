import assert from "node:assert/strict";
import test from "node:test";
import { BruMathDataRepository } from "./BruMathDataRepository";
import { DEFAULT_PERSONAL_LIMITS } from "../finance/personalLimits";

const defaults = {
  expenses: [],
  installments: [],
  debts: [],
  incomeEntries: [],
  income: 13_000,
  budgets: { Casa: 2_500 },
  limits: { Bruna: 350, Matheus: 350 },
  personalLimits: DEFAULT_PERSONAL_LIMITS,
  creditCards: [],
  invoicePayments: [],
  activeProfile: "Bruna" as const,
  viewMonth: "2026-09",
};

test("loads the existing brumath-data shape and keeps legacy debt months compatible", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  values.set(
    "brumath-data",
    JSON.stringify({
      expenses: [],
      installments: [],
      debts: [
        {
          id: 1,
          person: "João",
          amount: 100,
          destination: "bruna",
          note: "",
          paid: 0,
        },
      ],
      incomeEntries: [],
      viewMonth: "2026-08",
    }),
  );

  try {
    const repository = new BruMathDataRepository();
    const loaded = repository.load(defaults);

    assert.equal(loaded.debts[0]?.month, "2026-08");
    assert.equal(loaded.income, 13_000);
    assert.deepEqual(loaded.limits, { Bruna: 350, Matheus: 350 });
    assert.deepEqual(loaded.personalLimits, DEFAULT_PERSONAL_LIMITS);

    repository.save(loaded);
    assert.deepEqual(JSON.parse(values.get("brumath-data") ?? "{}"), loaded);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("persists and reloads a newly created credit card", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });

  try {
    const repository = new BruMathDataRepository();
    const card = {
      id: 7,
      name: "Nubank Bruna",
      owner: "Bruna" as const,
      creditLimit: 5_000,
      closingDay: 20,
      dueDay: 27,
      active: true,
    };
    repository.save({ ...defaults, creditCards: [card] });
    const reloaded = repository.load(defaults);

    assert.deepEqual(reloaded.creditCards, [card]);
    assert.equal(reloaded.creditCards[0]?.creditLimit, 5_000);
    assert.equal(reloaded.creditCards[0]?.closingDay, 20);
    assert.equal(reloaded.creditCards[0]?.dueDay, 27);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("persists and reloads an edited base income independently from income entries", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });

  try {
    const repository = new BruMathDataRepository();
    repository.save({
      ...defaults,
      income: 15_500,
      incomeEntries: [
        {
          id: 1,
          title: "Reembolso",
          amount: 75,
          who: "Casal",
          date: "2026-09-05",
          destination: "conta",
          note: "",
        },
      ],
    });

    const reloaded = repository.load(defaults);
    assert.equal(reloaded.income, 15_500);
    assert.equal(reloaded.incomeEntries.length, 1);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("upgrades a legacy snapshot to a persisted category catalog without changing totals", () => {
  const values = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  });
  try {
    const repository = new BruMathDataRepository();
    repository.save({
      ...defaults,
      expenses: [
        {
          id: 92,
          title: "Histórico",
          cat: "Categoria antiga",
          who: "Casal",
          amount: 91,
          date: "2026-09-01",
        },
      ],
      installments: [],
      budgets: { Transporte: 80 },
    });
    const reloaded = repository.load(defaults);
    assert.equal(reloaded.expenses[0]?.amount, 91);
    assert.ok(reloaded.expenses[0]?.categoryId);
    assert.ok(
      reloaded.categories?.some((item) => item.name === "Categoria antiga"),
    );
    assert.ok(reloaded.categories?.some((item) => item.name === "Transporte"));
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
