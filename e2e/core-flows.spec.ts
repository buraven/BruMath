import { expect, test, type Page } from "@playwright/test";
import {
  createFinancialState,
  openWithFinancialState,
  waitForPersistedFinancialState,
} from "./helpers/financialState";

async function openTab(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).first().click();
}

test("Home e perfis reconciliam o mesmo mês sem misturar responsáveis @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      income: 1_000,
      expenses: [
        {
          id: 1,
          title: "Bruna",
          cat: "Pessoal",
          who: "Bruna",
          amount: 100,
          date: "2026-08-10",
        },
        {
          id: 2,
          title: "Matheus",
          cat: "Pessoal",
          who: "Matheus",
          amount: 200,
          date: "2026-08-11",
        },
        {
          id: 3,
          title: "Casal",
          cat: "Casa",
          who: "Casal",
          amount: 300,
          date: "2026-08-12",
        },
      ],
    }),
  );

  await openTab(page, "Categorias");
  await expect(page.getByText("R$ 100,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Matheus", exact: true }).click();
  await expect(page.getByText("R$ 200,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Casal", exact: true }).click();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Casa" })
      .getByText("R$ 300,00", { exact: true }),
  ).toBeVisible();
  await waitForPersistedFinancialState(
    page,
    (state) => state.activeProfile === "Casal",
    "perfil ativo Casal",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Casal", exact: true }),
  ).toHaveClass(/active/);
});

test("Gasto criado, editado e excluído atualiza categoria e bucket sem duplicar @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page);
  await openTab(page, "Gastos");
  await page.getByRole("button", { name: "Novo gasto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("O que foi?").fill("Almoço de trabalho");
  await dialog.getByLabel("Valor").fill("5000");
  await dialog.getByLabel("Categoria").selectOption({ label: "Alimentação" });
  await dialog.getByLabel("Quem").selectOption("Bruna");
  await dialog.getByLabel("Usar limite pessoal").selectOption("bruna_personal");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(
    page.getByText("Almoço de trabalho", { exact: true }),
  ).toBeVisible();
  await waitForPersistedFinancialState(
    page,
    (state) => {
      const expense = state.expenses.find(
        (item) => item.title === "Almoço de trabalho",
      );
      return Boolean(
        expense?.cat === "Alimentação" &&
          expense.categoryId &&
          state.categories?.some(
            (category) =>
              category.id === expense.categoryId &&
              category.name === "Alimentação",
          ) &&
          expense.personalLimitBucket === "bruna_personal",
      );
    },
    "gasto Almoço de trabalho com categoria e bucket coerentes",
  );

  await page.getByLabel("Editar Almoço de trabalho").click();
  await page.getByRole("dialog").getByLabel("Valor").fill("6000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar gasto" })
    .click();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Almoço de trabalho" })
      .getByText("R$ 60,00", { exact: true }),
  ).toBeVisible();

  for (const [title, bucket, who] of [
    ["Unha", "bruna_nails", "Bruna"],
    ["Cabelo", "matheus_personal", "Matheus"],
  ]) {
    await page.getByRole("button", { name: "Novo gasto" }).click();
    const newDialog = page.getByRole("dialog");
    await newDialog.getByLabel("O que foi?").fill(title);
    await newDialog.getByLabel("Valor").fill("4000");
    await newDialog.getByLabel("Quem").selectOption(who);
    await newDialog.getByLabel("Usar limite pessoal").selectOption(bucket);
    await newDialog.getByRole("button", { name: "Salvar gasto" }).click();
  }
  await expect(page.getByText("Unha", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Matheus", exact: true }).click();
  await expect(page.getByText("Cabelo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bruna", exact: true }).click();

  await page.getByLabel("Excluir Almoço de trabalho").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Excluir gasto/ })
    .click();
  await expect(
    page.getByText("Almoço de trabalho", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Almoço de trabalho", { exact: true }),
  ).toHaveCount(0);
});

test("seletor de data mantém dia local ao criar, editar e recarregar um gasto @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page);
  await openTab(page, "Gastos");
  await page.getByRole("button", { name: "Novo gasto" }).click();

  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("O que foi?").fill("Consulta");
  await dialog.getByLabel("Valor").fill("9000");
  await dialog.getByLabel("Selecionar data pelo calendário").fill("2026-08-15");
  await expect(dialog.getByPlaceholder("DD/MM/AAAA")).toHaveValue("15/08/2026");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();

  await waitForPersistedFinancialState(
    page,
    (state) =>
      state.expenses.some(
        (expense) =>
          expense.title === "Consulta" && expense.date === "2026-08-15",
      ),
    "gasto Consulta em 2026-08-15",
  );
  await page.reload();
  await openTab(page, "Gastos");
  await expect(page.getByText("Consulta", { exact: true })).toBeVisible();

  await page.getByLabel("Editar Consulta").click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByPlaceholder("DD/MM/AAAA")).toHaveValue("15/08/2026");
  await dialog.getByLabel("Selecionar data pelo calendário").fill("2026-08-16");
  await expect(dialog.getByPlaceholder("DD/MM/AAAA")).toHaveValue("16/08/2026");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();

  await waitForPersistedFinancialState(
    page,
    (state) =>
      state.expenses.some(
        (expense) =>
          expense.title === "Consulta" && expense.date === "2026-08-16",
      ),
    "edição da data de Consulta em 2026-08-16",
  );
  await page.reload();
  await expect(page.getByText(/Bruna · 16\/08/)).toBeVisible();
});

test("Entradas e recebimentos parciais persistem pelo fluxo real @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page);
  await openTab(page, "Entradas & extras");
  await page.getByRole("button", { name: "Nova entrada" }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Entrada", exact: true })
    .fill("Reembolso");
  await dialog.getByLabel("Valor").fill("25000");
  await dialog.getByRole("button", { name: "Salvar entrada" }).click();
  await expect(page.getByText("Reembolso", { exact: true })).toBeVisible();

  await openTab(page, "Quem me deve");
  await page.getByRole("button", { name: "Novo valor" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quem deve?").fill("João");
  await dialog.getByLabel("Valor total").fill("10000");
  await dialog.getByRole("button", { name: "Salvar valor a receber" }).click();
  await page.getByRole("button", { name: "Recebi" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quanto você recebeu?").fill("4000");
  await dialog
    .getByRole("button", { name: "Registrar recebimento", exact: true })
    .click();
  await expect(
    page.getByText("R$ 60,00 em aberto", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recebi" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quanto você recebeu?").fill("6000");
  await dialog
    .getByRole("button", { name: "Registrar recebimento", exact: true })
    .click();
  await expect(page.getByText(/Quitado/)).toBeVisible();
  await waitForPersistedFinancialState(
    page,
    (state) =>
      state.debts.some(
        (debt) => debt.person === "João" && debt.paid >= debt.amount,
      ),
    "recebível de João quitado",
  );
  await page.reload();
  await openTab(page, "Quem me deve");
  await expect(page.getByText("João", { exact: true })).toBeVisible();
});

test("Parcelamento é criado e avançado pela interface com confirmação @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page);
  await openTab(page, "Calendário");
  await page.getByRole("button", { name: "Nova parcela" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Notebook");
  await dialog.getByLabel("Valor mensal").fill("10000");
  await dialog.getByLabel("Total de parcelas").fill("3");
  await dialog.getByRole("button", { name: "Salvar parcela" }).click();
  await expect(page.getByText("Notebook", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Quitar/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar quitação" })
    .click();
  await expect(page.getByText("Notebook", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Notebook", { exact: true })).toHaveCount(0);
});

test("Assistente mockado consulta e confirma mutação uma única vez @desktop", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    const body = route.request().postDataJSON() as { message: string };
    const plan = body.message.includes("almoço")
      ? {
          kind: "register-expense",
          input: {
            description: "Almoço",
            amount: 25,
            category: "Alimentação",
            owner: "Bruna",
          },
        }
      : { kind: "message", message: "Consulta determinística concluída." };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, plan }),
    });
  });
  await openWithFinancialState(page);
  await openTab(page, "Assistente");
  const input = page.getByLabel("Mensagem para o BruMath");
  await input.fill("consulta");
  await page.getByLabel("Enviar mensagem").click();
  await expect(
    page.getByText("Consulta determinística concluída."),
  ).toBeVisible();
  await input.fill("registrar almoço");
  await page.getByLabel("Enviar mensagem").click();
  await expect(page.getByRole("dialog")).toContainText("Almoço");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await openTab(page, "Gastos");
  await expect(page.getByText("Almoço", { exact: true })).toHaveCount(0);
  await openTab(page, "Assistente");
  await page.getByLabel("Mensagem para o BruMath").fill("registrar almoço");
  await page.getByLabel("Enviar mensagem").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar gasto" })
    .click();
  await openTab(page, "Gastos");
  await expect(page.getByText("Almoço", { exact: true })).toHaveCount(1);
  await waitForPersistedFinancialState(
    page,
    (state) =>
      state.expenses.some(
        (expense) => expense.title === "Almoço" && expense.amount === 25,
      ),
    "gasto Almoço de R$ 25 persistido",
  );
  await page.reload();
  await expect(page.getByText("Almoço", { exact: true })).toHaveCount(1);
});
