import { expect, test } from "@playwright/test";
import {
  coffeeExpense,
  createFinancialState,
  mercadoPagoCard,
  nubankCard,
  openInvoices,
  openWithFinancialState,
  waitForPersistedFinancialState,
} from "./helpers/financialState";

async function createNubankCard(page: Parameters<typeof openInvoices>[0]) {
  await page.getByRole("button", { name: "Novo cartão" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do cartão").fill("Nubank");
  await dialog.getByLabel("Instituição / bandeira").fill("Mastercard");
  await dialog.getByLabel("Titular").selectOption("Bruna");
  await dialog.getByLabel("Limite de crédito").fill("1072000");
  await dialog.getByLabel("Fecha no dia").fill("20");
  await dialog.getByLabel("Vence no dia").fill("27");
  await dialog.getByRole("button", { name: "Salvar cartão" }).click();
  await expect(dialog).toBeHidden();
}

test("cria cartão, adiciona compra e mantém a fatura após reload @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page);
  await openInvoices(page);
  await createNubankCard(page);

  await expect(page.getByText("Nubank", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Em andamento", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Resumo das faturas")).toContainText(
    "0 faturas abertas",
  );

  await page.getByRole("button", { name: /Ver fatura e lançamentos/ }).click();
  await expect(page.getByRole("button", { name: "Pagar fatura" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Adicionar compra" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("O que foi?").fill("Café");
  await dialog.getByLabel("Valor").fill("10000");
  await dialog.getByLabel("Categoria").selectOption("Alimentação");
  await dialog.getByLabel("Quem").selectOption("Bruna");
  await expect(dialog.getByLabel("Cartão")).toHaveValue(/\d+/);
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();

  await expect(page.getByText("Café", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 100,00").first()).toBeVisible();
  await expect(page.getByText(/R\$ 10\.620,00 disponível/)).toBeVisible();

  await page.getByRole("button", { name: "Voltar para faturas" }).click();
  await expect(page.getByLabel("Resumo das faturas")).toContainText(
    "R$ 100,00",
  );
  await expect(page.getByLabel("Resumo das faturas")).toContainText(
    "1 fatura aberta",
  );
  await expect(page.getByLabel("Resumo das faturas")).toContainText("27/08");
  await expect(page.getByText("Aberta", { exact: true })).toBeVisible();

  await waitForPersistedFinancialState(
    page,
    (state) => {
      const card = state.creditCards.find((item) => item.name === "Nubank");
      return Boolean(
        card &&
          state.expenses.some(
            (expense) =>
              expense.title === "Café" &&
              expense.amount === 100 &&
              expense.creditCardId === card.id,
          ),
      );
    },
    "cartão Nubank e compra Café vinculada",
  );
  await page.reload();
  await openInvoices(page);
  await expect(page.getByText("Nubank", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("R$ 100,00").first()).toBeVisible();
});

test("ciclo vazio permanece visível sem inflar dívida ou filtros @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      creditCards: [nubankCard, mercadoPagoCard],
      expenses: [coffeeExpense],
    }),
  );
  await openInvoices(page);

  const summary = page.getByLabel("Resumo das faturas");
  await expect(summary).toContainText("R$ 100,00");
  await expect(summary).toContainText("1 fatura aberta");
  await expect(summary).toContainText("27/08");
  await expect(page.getByText("Em andamento", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Abertas" }).click();
  await expect(page.getByText("Nubank", { exact: true })).toBeVisible();
  await expect(page.getByText("Mercado Pago", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "A vencer" }).click();
  await expect(page.getByText("Nubank", { exact: true })).toBeVisible();
  await expect(page.getByText("Mercado Pago", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Todas" }).click();
  await expect(page.getByText("Mercado Pago", { exact: true })).toBeVisible();
});

test("edita e exclui compra, retornando o ciclo ao estado em andamento @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      creditCards: [nubankCard],
      expenses: [coffeeExpense],
    }),
  );
  await openInvoices(page);
  await page.getByRole("button", { name: /Ver fatura e lançamentos/ }).click();

  await page.getByRole("button", { name: "Editar gasto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("12500");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(page.getByText("R$ 125,00").first()).toBeVisible();

  await page.getByRole("button", { name: "Excluir gasto" }).click();
  const confirmation = page.getByRole("dialog");
  await confirmation.getByRole("button", { name: "Excluir gasto" }).click();
  await expect(page.getByText("Nenhum lançamento neste ciclo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar fatura" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Voltar para faturas" }).click();
  await expect(page.getByText("Em andamento", { exact: true })).toBeVisible();
});

test("pagamento exige confirmação e preserva a compra original @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      creditCards: [nubankCard],
      expenses: [coffeeExpense],
    }),
  );
  await openInvoices(page);
  await page.getByRole("button", { name: /Ver fatura e lançamentos/ }).click();
  await page.getByRole("button", { name: "Pagar fatura" }).click();

  const confirmation = page.getByRole("dialog");
  await expect(
    confirmation.getByRole("heading", { name: "Pagar fatura" }),
  ).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Confirmar pagamento" })
    .click();
  await expect(page.getByText("Fatura paga", { exact: true })).toBeVisible();
  await expect(page.getByText("Café", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Voltar para faturas" }).click();
  const summary = page.getByLabel("Resumo das faturas");
  await expect(summary).toContainText("R$ 0,00");
  await expect(summary).toContainText("R$ 100,00");
  await page.getByRole("button", { name: "Pagas" }).click();
  await expect(page.getByText("Nubank", { exact: true })).toBeVisible();
});

test("navegação e último CTA permanecem utilizáveis sem overflow horizontal grave @responsive", async ({
  page,
}) => {
  const cards = Array.from({ length: 6 }, (_, index) => ({
    ...nubankCard,
    id: 300 + index,
    name: `Cartão ${index + 1}`,
  }));
  const expenses = cards.map((card, index) => ({
    ...coffeeExpense,
    id: 400 + index,
    title: `Compra ${index + 1}`,
    creditCardId: card.id,
  }));
  await openWithFinancialState(
    page,
    createFinancialState({ creditCards: cards, expenses }),
  );
  await openInvoices(page);

  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
  const lastDetail = page
    .getByRole("button", { name: /Ver fatura e lançamentos/ })
    .last();
  await lastDetail.scrollIntoViewIfNeeded();
  await lastDetail.click();
  await expect(page.getByRole("heading", { name: "Cartão 6" })).toBeVisible();
});
