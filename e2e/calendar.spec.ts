import { expect, test } from "@playwright/test";
import {
  createFinancialState,
  nubankCard,
  openCalendar,
  openWithFinancialState,
  waitForPersistedFinancialState,
} from "./helpers/financialState";

test("calendário projeta histórico, compromisso e vencimento sem duplicar compras @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      viewMonth: "2026-09",
      activeProfile: "Bruna",
      income: 1_000,
      expenses: [
        {
          id: 1,
          title: "Café de setembro",
          cat: "Alimentação",
          who: "Bruna",
          amount: 25,
          date: "2026-09-05",
        },
        {
          id: 2,
          title: "Compra Nubank",
          cat: "Casa",
          who: "Bruna",
          amount: 100,
          date: "2026-08-10",
          creditCardId: nubankCard.id,
        },
      ],
      incomeEntries: [
        {
          id: 3,
          title: "Freela",
          amount: 80,
          who: "Bruna",
          date: "2026-09-09",
          destination: "conta",
          note: "",
        },
      ],
      installments: [
        {
          id: 4,
          title: "Notebook",
          category: "Trabalho",
          who: "Bruna",
          amount: 200,
          totalInstallments: 3,
          paidInstallments: 0,
          nextDue: "2026-09-15",
        },
      ],
      creditCards: [{ ...nubankCard, dueDay: 10 }],
    }),
  );
  await openCalendar(page);

  await page.getByRole("button", { name: "Selecionar 2026-09-05" }).click();
  await expect(
    page.getByText("Café de setembro", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Agenda do dia")).toContainText(
    "Gasto registrado",
  );

  await page.getByRole("button", { name: "Selecionar 2026-09-10" }).click();
  await expect(
    page.getByText("Vencimento Nubank", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("R$ 100,00", { exact: true })).toBeVisible();
  await expect(page.getByText("Compra Nubank", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Selecionar 2026-09-15" }).click();
  await expect(page.getByLabel("Agenda do dia")).toContainText("Notebook");
  await expect(page.getByLabel("Agenda do dia")).toContainText("Compromisso");
  await page.reload();
  await openCalendar(page);
  await page.getByRole("button", { name: "Selecionar 2026-09-15" }).click();
  await expect(page.getByLabel("Agenda do dia")).toContainText("Notebook");
});

test("calendário filtra perfil e reutiliza a ação existente de parcela @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      viewMonth: "2026-09",
      expenses: [
        {
          id: 11,
          title: "Gasto da Bruna",
          cat: "Pessoal",
          who: "Bruna",
          amount: 30,
          date: "2026-09-12",
        },
        {
          id: 12,
          title: "Gasto do Matheus",
          cat: "Pessoal",
          who: "Matheus",
          amount: 45,
          date: "2026-09-12",
        },
      ],
      installments: [
        {
          id: 13,
          title: "Curso",
          category: "Educação",
          who: "Bruna",
          amount: 90,
          totalInstallments: 2,
          paidInstallments: 0,
          nextDue: "2026-09-12",
        },
      ],
    }),
  );
  await openCalendar(page);
  await page.getByRole("button", { name: "Selecionar 2026-09-12" }).click();
  await expect(page.getByText("Gasto da Bruna", { exact: true })).toBeVisible();
  await expect(page.getByText("Gasto do Matheus", { exact: true })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Matheus", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar 2026-09-12" }).click();
  await expect(
    page.getByText("Gasto do Matheus", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Curso", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Bruna", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar 2026-09-12" }).click();
  await page
    .getByRole("button", { name: /Pagar 1/ })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Acompanhe seus compromissos" }),
  ).toContainText("Próximo: 12/10");
  await expect(page.getByText("Curso", { exact: true })).toHaveCount(1);
  await waitForPersistedFinancialState(
    page,
    (state) =>
      state.installments.some(
        (item) =>
          item.title === "Curso" &&
          item.paidInstallments === 1 &&
          item.nextDue === "2026-10-12",
      ),
    "Curso com 1 parcela paga e próximo vencimento em 12/10",
  );
  await page.reload();
  await openCalendar(page);
  await page.getByRole("button", { name: "Selecionar 2026-09-12" }).click();
  await expect(page.getByLabel("Agenda do dia")).not.toContainText("Curso");
});

test("calendário mostra a fatura e não repete a parcela vinculada ao cartão @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      viewMonth: "2026-10",
      creditCards: [{ ...nubankCard, dueDay: 10 }],
      installments: [
        {
          id: 30,
          title: "Mercado Livre",
          category: "Casa",
          who: "Bruna",
          amount: 153.75,
          totalInstallments: 10,
          paidInstallments: 2,
          nextDue: "2026-09-20",
          creditCardId: nubankCard.id,
        },
      ],
    }),
  );
  await openCalendar(page);

  await page.getByRole("button", { name: "Selecionar 2026-10-10" }).click();
  await expect(page.getByLabel("Agenda do dia")).toContainText(
    "Vencimento Nubank",
  );
  await expect(page.getByLabel("Agenda do dia")).not.toContainText(
    "Mercado Livre",
  );
  await expect(page.getByLabel("Resumo do calendário")).toContainText(
    "R$ 153,75",
  );
  await expect(
    page.getByRole("region", { name: "Acompanhe seus compromissos" }),
  ).toContainText("Nenhuma parcela ativa.");
});
