import type { Page } from "@playwright/test";

export function createFinancialState(overrides: Record<string, unknown> = {}) {
  return {
    expenses: [],
    installments: [],
    debts: [],
    incomeEntries: [],
    income: 13_000,
    budgets: {
      Casa: 2_500,
      Carro: 3_000,
      Alimentação: 1_400,
      Pets: 650,
      Assinaturas: 500,
      Saúde: 500,
      Educação: 500,
      Pessoal: 1_000,
      Lazer: 700,
      Trabalho: 300,
      Outros: 500,
    },
    limits: { Bruna: 350, Matheus: 350 },
    personalLimits: {
      bruna_nails: 150,
      bruna_personal: 350,
      matheus_personal: 350,
    },
    creditCards: [],
    invoicePayments: [],
    activeProfile: "Bruna",
    viewMonth: "2026-08",
    ...overrides,
  };
}

export async function openWithFinancialState(
  page: Page,
  state = createFinancialState(),
) {
  await page.goto("/");
  await page.evaluate((snapshot) => {
    window.localStorage.clear();
    window.localStorage.setItem("brumath-data", JSON.stringify(snapshot));
    window.localStorage.setItem("brumath-theme", "light");
  }, state);
  await page.reload();
  await page
    .getByRole("heading", { name: /gastos de agosto de 2026/i })
    .waitFor();
}

export async function openInvoices(page: Page) {
  const directNavigation = page
    .getByRole("button", { name: "Faturas" })
    .first();
  if (await directNavigation.isVisible()) {
    await directNavigation.click();
  } else {
    await page.getByRole("button", { name: "Mais" }).click();
    await page.getByRole("button", { name: "Faturas" }).last().click();
  }
  await page.getByRole("heading", { name: "Faturas" }).waitFor();
}

export const nubankCard = {
  id: 101,
  name: "Nubank",
  issuer: "Mastercard",
  owner: "Bruna",
  creditLimit: 10_720,
  closingDay: 20,
  dueDay: 27,
  appearance: "purple",
  active: true,
} as const;

export const mercadoPagoCard = {
  id: 102,
  name: "Mercado Pago",
  issuer: "Visa",
  owner: "Bruna",
  creditLimit: 5_000,
  closingDay: 20,
  dueDay: 27,
  appearance: "blue",
  active: true,
} as const;

export const coffeeExpense = {
  id: 201,
  title: "Café",
  cat: "Alimentação",
  who: "Bruna",
  amount: 100,
  date: "2026-08-10",
  creditCardId: nubankCard.id,
} as const;
