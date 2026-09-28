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

test("cria cartão, adiciona compra e mantém a fatura após reload @desktop @responsive", async ({
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

  const typeDialog = page.getByRole("dialog");
  await typeDialog.getByRole("button", { name: /À vista/ }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("O que foi?").fill("Café");
  await dialog.getByLabel("Valor").fill("10000");
  await dialog.getByPlaceholder("DD/MM/AAAA").fill("25/08/2026");
  await dialog.getByLabel("Categoria").selectOption({ label: "Alimentação" });
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
              expense.date === "2026-08-25" &&
              expense.creditCardId === card.id &&
              expense.invoiceReferenceMonth === "2026-08" &&
              expense.cat === "Alimentação" &&
              Boolean(expense.categoryId) &&
              state.categories?.some(
                (category) =>
                  category.id === expense.categoryId &&
                  category.name === "Alimentação",
              ),
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

test("adiciona uma compra parcelada na competência explícita da fatura sem criar gasto @desktop @responsive", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({ creditCards: [nubankCard] }),
  );
  await openInvoices(page);
  await page.getByRole("button", { name: /Ver fatura e lançamentos/ }).click();
  await page.getByRole("button", { name: "Adicionar compra" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Parcelado/ })
    .click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("O que foi?").fill("Notebook");
  await dialog.getByLabel("Valor total da compra").fill("10000");
  await dialog.getByLabel("Quantidade de parcelas").fill("3");
  await dialog.getByLabel("Categoria").selectOption({ label: "Trabalho" });
  await dialog.getByLabel("Quem").selectOption("Bruna");
  await expect(dialog.getByLabel("Cartão")).toBeDisabled();
  await dialog.getByRole("button", { name: "Salvar compra parcelada" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Notebook", { exact: true })).toBeVisible();
  await expect(page.getByText(/parcela 1\/3/)).toBeVisible();
  await waitForPersistedFinancialState(
    page,
    (state) => {
      const plan = state.installments.find((item) => item.title === "Notebook");
      const schedule = state.installmentScheduleItems?.filter(
        (item) => item.installmentId === plan?.id,
      );
      return Boolean(
        plan &&
          plan.creditCardId === nubankCard.id &&
          schedule?.length === 3 &&
          schedule.every((item) => item.creditCardId === nubankCard.id) &&
          schedule.map((item) => item.invoiceReferenceMonth).join(",") ===
            "2026-08,2026-09,2026-10" &&
          schedule.reduce((total, item) => total + item.amount, 0) === 100 &&
          !state.expenses.some((expense) => expense.title === "Notebook"),
      );
    },
    "parcelamento Notebook com cronograma e sem gasto duplicado",
  );
  await page.getByRole("button", { name: "Voltar para faturas" }).click();
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Nubank" })
    .getByRole("button", { name: /Ver fatura e lançamentos/ })
    .click();
  await expect(page.getByText(/parcela 2\/3/)).toBeVisible();
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

test("edita somente o futuro de uma compra parcelada pela identidade da fatura @desktop @responsive", async ({
  page,
}) => {
  const plan = {
    id: 810,
    title: "Notebook",
    category: "Trabalho",
    who: "Bruna" as const,
    amount: 100,
    totalInstallments: 3,
    paidInstallments: 0,
    nextDue: "2026-08-27",
    creditCardId: nubankCard.id,
  };
  const schedule = [1, 2, 3].map((installmentNumber) => ({
    id: `installment:${plan.id}:${installmentNumber}`,
    installmentId: plan.id,
    installmentNumber,
    totalInstallments: 3,
    amount: 100,
    invoiceReferenceMonth: `2026-${String(7 + installmentNumber).padStart(2, "0")}`,
    dueDate: `2026-${String(7 + installmentNumber).padStart(2, "0")}-27`,
    creditCardId: nubankCard.id,
    status: "scheduled" as const,
  }));
  await openWithFinancialState(
    page,
    createFinancialState({
      creditCards: [nubankCard, mercadoPagoCard],
      installments: [plan],
      installmentScheduleItems: schedule,
    }),
  );
  await openInvoices(page);
  await page
    .getByRole("article")
    .filter({ hasText: "Nubank" })
    .getByRole("button", { name: /Ver fatura e lançamentos/ })
    .click();
  await page
    .getByRole("button", {
      name: /Editar parcelamento Notebook, parcela 1 de 3/,
    })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("0 de 3 parcelas consolidadas · 3 parcelas futuras"),
  ).toBeVisible();
  await expect(dialog.getByLabel("Categoria")).toHaveCount(1);
  await dialog.getByLabel("Total futuro restante").fill("24000");
  await dialog.getByLabel("Quantidade de parcelas futuras").fill("0");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toContainText(
    "Informe um valor e uma quantidade válidos para as parcelas futuras.",
  );
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Quantidade de parcelas futuras").fill("3");
  await dialog.getByLabel("Primeira competência futura").fill("2026-08");
  await dialog.getByLabel("Primeiro vencimento futuro").fill("28/08/2026");
  await dialog
    .getByLabel("Cartão das parcelas futuras")
    .selectOption(String(mercadoPagoCard.id));
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toBeHidden();
  await waitForPersistedFinancialState(
    page,
    (state) =>
      state.installments.some(
        (item) => item.id === plan.id && item.amount === 80,
      ) &&
      state.installmentScheduleItems?.every(
        (item) =>
          item.installmentId !== plan.id ||
          (item.amount === 80 &&
            item.creditCardId === mercadoPagoCard.id &&
            item.invoiceReferenceMonth ===
              `2026-${String(7 + item.installmentNumber).padStart(2, "0")}` &&
            item.dueDate ===
              ["2026-08-28", "2026-09-28", "2026-10-28"][
                item.installmentNumber - 1
              ]),
      ) === true,
    "edição prospectiva do parcelamento Notebook",
  );
  await page.getByRole("button", { name: "Voltar para faturas" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Mercado Pago" })
    .getByRole("button", { name: /Ver fatura e lançamentos/ })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Parcelas da fatura" })
      .getByText("R$ 80,00", { exact: true }),
  ).toBeVisible();
});

test("parcelamento legado não oferece a nova edição financeira na fatura @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      creditCards: [nubankCard],
      installments: [
        {
          id: 812,
          title: "Plano legado",
          category: "Trabalho",
          who: "Bruna",
          amount: 100,
          totalInstallments: 3,
          paidInstallments: 0,
          nextDue: "2026-08-27",
          creditCardId: nubankCard.id,
        },
      ],
    }),
  );
  await openInvoices(page);
  await page.getByRole("button", { name: /Ver fatura e lançamentos/ }).click();
  await expect(
    page.getByRole("button", { name: /Editar parcelamento Plano legado/ }),
  ).toHaveCount(0);
});

test("plano integralmente consolidado mantém somente metadados editáveis @desktop", async ({
  page,
}) => {
  const plan = {
    id: 811,
    title: "Curso",
    category: "Educação",
    who: "Bruna" as const,
    amount: 100,
    totalInstallments: 2,
    paidInstallments: 2,
    nextDue: "2026-08-27",
    creditCardId: nubankCard.id,
  };
  const schedule = [1, 2].map((installmentNumber) => ({
    id: `installment:${plan.id}:${installmentNumber}`,
    installmentId: plan.id,
    installmentNumber,
    totalInstallments: 2,
    amount: 100,
    invoiceReferenceMonth: "2026-08",
    dueDate: "2026-08-27",
    creditCardId: nubankCard.id,
    status: "scheduled" as const,
  }));
  const events = [1, 2].map((installmentNumber) => ({
    id: installmentNumber,
    installmentId: plan.id,
    cardId: nubankCard.id,
    referenceMonth: "2026-08",
    installmentNumber,
    amount: 100,
    type: "regular" as const,
    date: "2026-08-27",
  }));
  await openWithFinancialState(
    page,
    createFinancialState({
      creditCards: [nubankCard],
      installments: [plan],
      installmentScheduleItems: schedule,
      installmentInvoiceEvents: events,
    }),
  );
  await openInvoices(page);
  await page.getByRole("button", { name: /Ver fatura e lançamentos/ }).click();
  await page
    .getByRole("button", { name: /Editar parcelamento Curso, parcela 1 de 2/ })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Todas as parcelas já foram consolidadas.",
  );
  await expect(dialog.getByLabel("Total futuro restante")).toBeDisabled();
  await dialog.getByLabel("Descrição").fill("Curso atualizado");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Curso atualizado", { exact: true })).toHaveCount(
    2,
  );
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
