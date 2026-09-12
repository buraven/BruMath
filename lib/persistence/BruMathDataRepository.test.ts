import assert from "node:assert/strict";
import test from "node:test";
import { BruMathDataRepository } from "./BruMathDataRepository";

const defaults = {
  expenses: [],
  installments: [],
  debts: [],
  incomeEntries: [],
  income: 13_000,
  budgets: { Casa: 2_500 },
  limits: { Bruna: 350, Matheus: 350 },
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

    repository.save(loaded);
    assert.deepEqual(JSON.parse(values.get("brumath-data") ?? "{}"), loaded);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
