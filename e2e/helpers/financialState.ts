import type { Page } from "@playwright/test";
import type { AppFinancialData } from "../../lib/app/AppTypes";

export function createFinancialState(
  overrides: Partial<AppFinancialData> = {},
): AppFinancialData {
  const defaults: AppFinancialData = {
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
  };

  return { ...defaults, ...overrides };
}

export async function openWithFinancialState(
  page: Page,
  state = createFinancialState(),
) {
  await page.addInitScript((snapshot) => {
    const seededKey = "brumath-e2e-state-seeded";

    if (window.sessionStorage.getItem(seededKey)) {
      return;
    }

    window.localStorage.clear();
    window.localStorage.setItem("brumath-data", JSON.stringify(snapshot));
    window.localStorage.setItem("brumath-theme", "light");
    window.sessionStorage.setItem(seededKey, "true");
  }, state);
  await page.goto("/");
  const hydratedMonth = await page.evaluate(() => {
    const stored = window.localStorage.getItem("brumath-data");
    return stored
      ? (JSON.parse(stored).viewMonth as string | undefined)
      : undefined;
  });
  if (hydratedMonth !== state.viewMonth) {
    throw new Error(
      `A fixture E2E solicitou ${state.viewMonth}, mas a aplicação hidratou ${hydratedMonth ?? "sem mês"}.`,
    );
  }
  const formattedMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${state.viewMonth}-01T12:00:00`));
  await page
    .getByRole("heading", {
      name: new RegExp(`gastos de ${formattedMonth}`, "i"),
    })
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

export async function openCalendar(page: Page) {
  const directNavigation = page
    .getByRole("button", { name: "Calendário" })
    .first();
  if (await directNavigation.isVisible()) {
    await directNavigation.click();
  } else {
    await page.getByRole("button", { name: "Mais" }).click();
    await page.getByRole("button", { name: "Calendário" }).last().click();
  }
  await page
    .getByRole("heading", { name: "Planeje o mês com clareza" })
    .waitFor();
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
