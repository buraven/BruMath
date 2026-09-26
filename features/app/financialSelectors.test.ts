import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCategoryDetails,
  deriveCategorySpending,
  deriveFinancialSelectors,
} from "./financialSelectors";
import type { AppFinancialData } from "../../lib/app/AppTypes";
import { createFinancialContextProvider } from "../../lib/assistant/context/createFinancialContextProvider";
import { deriveCalendarProjection } from "../../lib/finance/calendar";
import { DEFAULT_PERSONAL_LIMITS } from "../../lib/finance/personalLimits";
import { DEFAULT_BUDGETS, INITIAL_EXPENSES } from "./defaultFinancialData";

test("derives the existing month, limit and receivable values without mixing periods", () => {
  const result = deriveFinancialSelectors({
    expenses: [
      {
        id: 1,
        title: "Mercado",
        cat: "Alimentação",
        who: "Bruna",
        amount: 100,
        date: "2026-09-02",
      },
      {
        id: 2,
        title: "Antigo",
        cat: "Alimentação",
        who: "Matheus",
        amount: 50,
        date: "2026-08-30",
      },
    ],
    installments: [
      {
        id: 1,
        title: "Notebook",
        category: "Trabalho",
        who: "Bruna",
        amount: 200,
        totalInstallments: 3,
        paidInstallments: 1,
        nextDue: "2026-09-10",
      },
    ],
    debts: [
      {
        id: 1,
        person: "João",
        amount: 300,
        paid: 100,
        destination: "bruna",
        note: "",
        month: "2026-09",
      },
    ],
    incomeEntries: [
      {
        id: 1,
        title: "Reembolso",
        amount: 50,
        who: "Bruna",
        date: "2026-09-03",
        destination: "conta",
        note: "",
      },
      {
        id: 2,
        title: "Cartão",
        amount: 70,
        who: "Bruna",
        date: "2026-09-03",
        destination: "cartao",
        note: "",
      },
    ],
    income: 1_000,
    budgets: { Alimentação: 400 },
    limits: { Bruna: 350, Matheus: 350 },
    viewMonth: "2026-09",
    profile: "Casal",
  });

  assert.equal(result.totalSpent, 100);
  assert.equal(result.extraIncome, 50);
  assert.equal(result.monthIncomeTotal, 1_050);
  assert.equal(result.available, 950);
  assert.equal(result.debtTotal, 200);
  assert.equal(result.remaining, 2);
  assert.deepEqual(
    result.limitItems.find((item) => item.id === "personal:bruna_total"),
    {
      id: "personal:bruna_total",
      label: "Bruna — Total pessoal",
      owner: "Bruna",
      amount: 500,
      spent: 0,
    },
  );
  assert.equal(
    result.limitItems.find((item) => item.id === "category:Alimentação")?.spent,
    100,
  );
});

test("uses an identity budget after rename without reviving its old text bucket", () => {
  const result = deriveFinancialSelectors({
    expenses: [
      {
        id: 1,
        title: "Mercado",
        cat: "Alimentação",
        categoryId: "legacy:alimentação",
        who: "Casal",
        amount: 100,
        date: "2026-09-02",
      },
    ],
    installments: [],
    debts: [],
    incomeEntries: [],
    income: 1000,
    // V4's compatibility map is empty after this value has been promoted.
    budgets: {},
    categoryBudgets: { "legacy:alimentação": 1400 },
    categories: [
      {
        id: "legacy:alimentação",
        name: "Comida",
        active: true,
        sortOrder: 0,
      },
    ],
    limits: { Bruna: 350, Matheus: 350 },
    viewMonth: "2026-09",
    profile: "Casal",
  });

  assert.deepEqual(
    result.limitItems.filter((item) => item.id.startsWith("category:")),
    [
      {
        id: "category:legacy:alimentação",
        label: "Comida",
        amount: 1400,
        spent: 100,
      },
    ],
  );
});

test("updates base income without treating it as an extra entry", async () => {
  const data: AppFinancialData = {
    expenses: [
      {
        id: 1,
        title: "Mercado",
        cat: "Alimentação",
        who: "Casal",
        amount: 100,
        date: "2026-09-05",
      },
    ],
    installments: [
      {
        id: 2,
        title: "Curso",
        category: "Educação",
        who: "Casal",
        amount: 50,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-09-20",
      },
    ],
    debts: [],
    incomeEntries: [
      {
        id: 3,
        title: "Reembolso",
        amount: 40,
        who: "Casal",
        date: "2026-09-10",
        destination: "conta",
        note: "",
      },
    ],
    income: 1_000,
    budgets: {},
    limits: { Bruna: 350, Matheus: 350 },
    personalLimits: DEFAULT_PERSONAL_LIMITS,
    creditCards: [],
    invoicePayments: [],
    activeProfile: "Casal",
    viewMonth: "2026-09",
  };
  const edited = { ...data, income: 1_500 };
  const home = deriveFinancialSelectors({ ...edited, profile: "Casal" });

  assert.equal(home.extraIncome, 40);
  assert.equal(home.monthIncomeTotal, 1_540);
  assert.equal(home.available, 1_440);

  const calendar = deriveCalendarProjection({
    month: edited.viewMonth,
    profile: "Casal",
    expenses: edited.expenses,
    incomeEntries: edited.incomeEntries,
    installments: edited.installments,
    cards: [],
    payments: [],
    baseBalance: home.available,
  });
  assert.equal(calendar.forecast.projectedBalance, 1_390);

  const context = createFinancialContextProvider({ read: async () => edited });
  const summary = await context.getSummary({
    profile: "Casal",
    month: "2026-09",
  });
  assert.equal(summary.value.baseIncome, 1_500);
  assert.equal(summary.value.extraIncome, 40);
  assert.equal(summary.value.available, 1_440);
});

test("derives category distribution only from the selected expenses", () => {
  const result = deriveCategorySpending([
    {
      id: 1,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna",
      amount: 75,
      date: "2026-09-02",
    },
    {
      id: 2,
      title: "Uber",
      cat: "Transporte",
      who: "Matheus",
      amount: 25,
      date: "2026-09-03",
    },
    {
      id: 3,
      title: "Restaurante",
      cat: "Alimentação",
      who: "Casal",
      amount: 50,
      date: "2026-09-04",
    },
  ]);

  assert.deepEqual(result, [
    { category: "Alimentação", amount: 125, percentage: 83.33333333333334 },
    { category: "Transporte", amount: 25, percentage: 16.666666666666664 },
  ]);
  assert.deepEqual(deriveCategorySpending([]), []);
});

test("derives category detail with profile scope and explicit no-limit states", () => {
  const expenses = [
    {
      id: 1,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna" as const,
      amount: 90,
      date: "2026-09-02",
    },
    {
      id: 2,
      title: "Uber",
      cat: "Transporte",
      who: "Matheus" as const,
      amount: 130,
      date: "2026-09-03",
    },
    {
      id: 3,
      title: "Cinema",
      cat: "Lazer",
      who: "Bruna" as const,
      amount: 20,
      date: "2026-09-04",
    },
  ];

  const bruna = deriveCategoryDetails({
    expenses,
    budgets: { Alimentação: 100, Transporte: 100, Saúde: 0 },
    profile: "Bruna",
  });

  assert.deepEqual(
    bruna.map(({ category, spent, status }) => ({ category, spent, status })),
    [
      { category: "Alimentação", spent: 90, status: "warning" },
      { category: "Lazer", spent: 20, status: "unlimited" },
      { category: "Saúde", spent: 0, status: "unlimited" },
      { category: "Transporte", spent: 0, status: "normal" },
    ],
  );
  assert.equal(bruna[0]?.remaining, 10);
  assert.equal(bruna[1]?.limit, null);

  const casal = deriveCategoryDetails({
    expenses,
    budgets: { Alimentação: 100, Transporte: 100 },
    profile: "Casal",
  });
  assert.equal(
    casal.find((item) => item.category === "Transporte")?.status,
    "exceeded",
  );
});

test("reconciles August expenses and limits for every official profile scope", () => {
  const baseInput = {
    expenses: INITIAL_EXPENSES,
    installments: [],
    debts: [],
    incomeEntries: [],
    income: 13_000,
    budgets: DEFAULT_BUDGETS,
    limits: { Bruna: 350, Matheus: 350 },
    viewMonth: "2026-08",
  };
  const bruna = deriveFinancialSelectors({ ...baseInput, profile: "Bruna" });
  const matheus = deriveFinancialSelectors({
    ...baseInput,
    profile: "Matheus",
  });
  const casal = deriveFinancialSelectors({ ...baseInput, profile: "Casal" });

  assert.equal(bruna.totalSpent, 603.2);
  assert.deepEqual(
    bruna.monthExpenses.map((expense) => expense.title),
    ["FIES", "Mercado"],
  );
  assert.deepEqual(
    bruna.limitItems.find((item) => item.id === "personal:bruna_total"),
    {
      id: "personal:bruna_total",
      label: "Bruna — Total pessoal",
      owner: "Bruna",
      amount: 500,
      spent: 0,
    },
  );
  assert.equal(
    bruna.limitItems.some((item) => item.id === "personal:matheus_personal"),
    false,
  );
  const brunaCategories = deriveCategoryDetails({
    expenses: bruna.monthExpenses,
    budgets: DEFAULT_BUDGETS,
    profile: "Bruna",
  });
  assert.deepEqual(
    brunaCategories.find((category) => category.category === "Educação"),
    {
      category: "Educação",
      spent: 553.2,
      limit: null,
      remaining: null,
      percentage: null,
      status: "unlimited",
      expenses: [INITIAL_EXPENSES[6]],
    },
  );
  assert.equal(
    bruna.limitItems.find((item) => item.id === "category:Alimentação")?.spent,
    50,
  );

  assert.equal(matheus.totalSpent, 0);
  assert.deepEqual(matheus.monthExpenses, []);
  assert.deepEqual(
    matheus.limitItems.find((item) => item.id === "personal:matheus_personal"),
    {
      id: "personal:matheus_personal",
      label: "Matheus — Pessoal",
      owner: "Matheus",
      amount: 350,
      spent: 0,
    },
  );

  assert.equal(casal.totalSpent, 3883.2);
  assert.equal(casal.monthExpenses.length, INITIAL_EXPENSES.length);
  assert.deepEqual(
    casal.monthExpenses.map((expense) => expense.title),
    INITIAL_EXPENSES.map((expense) => expense.title),
  );

  const categories = deriveCategoryDetails({
    expenses: casal.monthExpenses,
    budgets: DEFAULT_BUDGETS,
    profile: "Casal",
  });
  assert.equal(
    categories.find((category) => category.category === "Carro")?.spent,
    2180,
  );
  assert.equal(
    categories.find((category) => category.category === "Casa")?.spent,
    1090,
  );
  assert.equal(
    categories.find((category) => category.category === "Educação")?.spent,
    553.2,
  );
  assert.equal(
    categories.find((category) => category.category === "Alimentação")?.spent,
    50,
  );
  assert.equal(
    categories.find((category) => category.category === "Pets")?.spent,
    10,
  );
});

test("uses only explicit personal buckets while retaining independent category totals", () => {
  const result = deriveFinancialSelectors({
    expenses: [
      {
        id: 1,
        title: "FIES",
        cat: "Educação",
        who: "Bruna",
        amount: 553.2,
        date: "2026-08-01",
      },
      {
        id: 2,
        title: "Mercado",
        cat: "Alimentação",
        who: "Bruna",
        amount: 50,
        date: "2026-08-02",
      },
      {
        id: 3,
        title: "Almoço",
        cat: "Alimentação",
        who: "Bruna",
        amount: 30,
        date: "2026-08-03",
        personalLimitBucket: "bruna_personal",
      },
      {
        id: 4,
        title: "Unha",
        cat: "Pessoal",
        who: "Bruna",
        amount: 40,
        date: "2026-08-04",
        personalLimitBucket: "bruna_nails",
      },
      {
        id: 5,
        title: "Cabelo",
        cat: "Pessoal",
        who: "Matheus",
        amount: 80,
        date: "2026-08-05",
        personalLimitBucket: "matheus_personal",
      },
    ],
    installments: [],
    debts: [],
    incomeEntries: [],
    income: 0,
    budgets: { Alimentação: 100, Pessoal: 100 },
    personalLimits: DEFAULT_PERSONAL_LIMITS,
    viewMonth: "2026-08",
    profile: "Casal",
  });

  assert.equal(result.totalSpent, 753.2);
  assert.equal(
    result.limitItems.find((item) => item.id === "personal:bruna_nails")?.spent,
    40,
  );
  assert.equal(
    result.limitItems.find((item) => item.id === "personal:bruna_personal")
      ?.spent,
    30,
  );
  assert.equal(
    result.limitItems.find((item) => item.id === "personal:bruna_total")?.spent,
    70,
  );
  assert.equal(
    result.limitItems.find((item) => item.id === "personal:matheus_personal")
      ?.spent,
    80,
  );
  assert.equal(
    result.limitItems.find((item) => item.id === "category:Alimentação")?.spent,
    80,
  );
  assert.equal(
    result.limitItems.find((item) => item.id === "category:Pessoal")?.spent,
    120,
  );
  assert.equal(
    deriveCategorySpending(result.monthExpenses).reduce(
      (total, category) => total + category.amount,
      0,
    ),
    result.totalSpent,
  );
});

test("recalculates a personal allowance when an expense bucket is changed or removed", () => {
  const baseExpense = {
    id: 1,
    title: "Almoço",
    cat: "Alimentação",
    who: "Bruna" as const,
    amount: 30,
    date: "2026-08-03",
  };
  const select = (personalLimitBucket?: "bruna_personal" | "bruna_nails") =>
    deriveFinancialSelectors({
      expenses: [
        {
          ...baseExpense,
          ...(personalLimitBucket ? { personalLimitBucket } : {}),
        },
      ],
      installments: [],
      debts: [],
      incomeEntries: [],
      income: 0,
      budgets: { Alimentação: 100 },
      personalLimits: DEFAULT_PERSONAL_LIMITS,
      viewMonth: "2026-08",
      profile: "Bruna",
    });

  const personal = select("bruna_personal");
  const nails = select("bruna_nails");
  const none = select();
  assert.equal(
    personal.limitItems.find((item) => item.id === "personal:bruna_personal")
      ?.spent,
    30,
  );
  assert.equal(
    nails.limitItems.find((item) => item.id === "personal:bruna_nails")?.spent,
    30,
  );
  assert.equal(
    none.limitItems.find((item) => item.id === "personal:bruna_total")?.spent,
    0,
  );
  for (const result of [personal, nails, none]) {
    assert.equal(result.totalSpent, 30);
    assert.equal(
      result.limitItems.find((item) => item.id === "category:Alimentação")
        ?.spent,
      30,
    );
  }
});

test("keeps Home, Calendar and Financial Context aligned for every profile", async () => {
  const data: AppFinancialData = {
    expenses: [
      {
        id: 1,
        title: "Mercado Bruna",
        cat: "Alimentação",
        who: "Bruna",
        amount: 100,
        date: "2026-09-02",
      },
      {
        id: 2,
        title: "Mercado Matheus",
        cat: "Alimentação",
        who: "Matheus",
        amount: 200,
        date: "2026-09-03",
      },
      {
        id: 3,
        title: "Mercado Casal",
        cat: "Alimentação",
        who: "Casal",
        amount: 300,
        date: "2026-09-04",
      },
    ],
    installments: [
      {
        id: 1,
        title: "Parcela Bruna",
        category: "Pessoal",
        who: "Bruna",
        amount: 10,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-09-10",
      },
      {
        id: 2,
        title: "Parcela Matheus",
        category: "Pessoal",
        who: "Matheus",
        amount: 20,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-09-11",
      },
      {
        id: 3,
        title: "Parcela Casal",
        category: "Casa",
        who: "Casal",
        amount: 30,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-09-12",
      },
    ],
    debts: [
      {
        id: 1,
        person: "A",
        amount: 100,
        paid: 0,
        destination: "bruna",
        note: "",
        month: "2026-09",
      },
      {
        id: 2,
        person: "B",
        amount: 200,
        paid: 90,
        destination: "matheus",
        note: "",
        month: "2026-09",
      },
      {
        id: 3,
        person: "C",
        amount: 300,
        paid: 0,
        destination: "casal",
        note: "",
        month: "2026-09",
      },
      {
        id: 4,
        person: "D",
        amount: 40,
        paid: 0,
        destination: "cartao",
        note: "",
        month: "2026-09",
      },
    ],
    incomeEntries: [
      {
        id: 1,
        title: "Entrada Bruna",
        amount: 20,
        who: "Bruna",
        date: "2026-09-05",
        destination: "conta",
        note: "",
      },
      {
        id: 2,
        title: "Entrada Matheus",
        amount: 30,
        who: "Matheus",
        date: "2026-09-06",
        destination: "conta",
        note: "",
      },
      {
        id: 3,
        title: "Entrada Casal",
        amount: 40,
        who: "Casal",
        date: "2026-09-07",
        destination: "conta",
        note: "",
      },
    ],
    income: 1000,
    budgets: { Alimentação: 1000 },
    limits: { Bruna: 350, Matheus: 350 },
    personalLimits: DEFAULT_PERSONAL_LIMITS,
    creditCards: [],
    invoicePayments: [],
    activeProfile: "Bruna",
    viewMonth: "2026-09",
  };
  const expected = {
    Bruna: { expenses: 100, extraIncome: 20, debts: 100, commitments: 10 },
    Matheus: {
      expenses: 200,
      extraIncome: 30,
      debts: 110,
      commitments: 20,
    },
    Casal: { expenses: 600, extraIncome: 90, debts: 550, commitments: 60 },
  } as const;
  const context = createFinancialContextProvider({ read: async () => data });

  for (const profile of ["Bruna", "Matheus", "Casal"] as const) {
    const home = deriveFinancialSelectors({ ...data, profile });
    const calendar = deriveCalendarProjection({
      month: data.viewMonth,
      profile,
      expenses: data.expenses,
      incomeEntries: data.incomeEntries,
      installments: data.installments,
      cards: data.creditCards,
      payments: data.invoicePayments,
      baseBalance: home.available,
    });
    const financialContext = await context.getContext({
      profile,
      month: data.viewMonth,
    });

    assert.equal(home.totalSpent, expected[profile].expenses);
    assert.equal(home.extraIncome, expected[profile].extraIncome);
    assert.equal(home.debtTotal, expected[profile].debts);
    assert.equal(home.activeInstallments.length, profile === "Casal" ? 3 : 1);
    assert.equal(
      deriveCategorySpending(home.monthExpenses).reduce(
        (total, category) => total + category.amount,
        0,
      ),
      home.totalSpent,
    );
    assert.equal(calendar.forecast.baseBalance, home.available);
    assert.equal(
      calendar.forecast.knownFutureCommitments,
      expected[profile].commitments,
    );
    assert.equal(financialContext.value.summary.expenses, home.totalSpent);
    assert.equal(financialContext.value.summary.extraIncome, home.extraIncome);
    assert.equal(
      financialContext.value.summary.receivablesOutstanding,
      home.debtTotal,
    );
    assert.equal(
      financialContext.value.installments.length,
      home.activeInstallments.length,
    );
  }
});
