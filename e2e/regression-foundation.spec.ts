import { expect, test, type Page } from "@playwright/test";
import {
  createFinancialState,
  openWithFinancialState,
} from "./helpers/financialState";

async function openTab(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).first().click();
}

function metric(page: Page, label: string) {
  return page
    .getByLabel("Resumo financeiro do mês")
    .getByRole("article")
    .filter({ hasText: label });
}

function limitItem(page: Page, label: string) {
  return page
    .getByLabel("Limites e categorias")
    .getByRole("article")
    .filter({ hasText: label });
}

test("troca de mês reconcilia Home, categorias e limites com dados reais @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      income: 1_000,
      incomeEntries: [
        {
          id: 1,
          title: "Extra agosto",
          amount: 100,
          who: "Bruna",
          date: "2026-08-05",
          destination: "conta",
          note: "",
        },
        {
          id: 2,
          title: "Extra setembro",
          amount: 200,
          who: "Bruna",
          date: "2026-09-05",
          destination: "conta",
          note: "",
        },
      ],
      expenses: [
        {
          id: 3,
          title: "Mercado agosto",
          amount: 300,
          cat: "Alimentação",
          who: "Bruna",
          date: "2026-08-10",
        },
        {
          id: 4,
          title: "Casa setembro",
          amount: 400,
          cat: "Casa",
          who: "Bruna",
          date: "2026-09-10",
        },
      ],
    }),
  );

  await expect(metric(page, "Orçamento mensal")).toContainText("R$ 1.100,00");
  await expect(metric(page, "Gasto até agora")).toContainText("R$ 300,00");
  await expect(metric(page, "Saldo disponível")).toContainText("R$ 800,00");
  await expect(page.getByText("Mercado agosto", { exact: true })).toBeVisible();

  await openTab(page, "Categorias");
  await expect(
    page.getByRole("article").filter({ hasText: "Alimentação" }),
  ).toContainText("R$ 300,00");
  await expect(
    page.getByRole("article").filter({ hasText: "Casa" }),
  ).toContainText("R$ 0,00");

  await page.getByLabel("Próximo mês").click();
  await openTab(page, "Início");
  await expect(metric(page, "Orçamento mensal")).toContainText("R$ 1.200,00");
  await expect(metric(page, "Gasto até agora")).toContainText("R$ 400,00");
  await expect(metric(page, "Saldo disponível")).toContainText("R$ 800,00");
  await expect(page.getByText("Casa setembro", { exact: true })).toBeVisible();
  await expect(page.getByText("Mercado agosto", { exact: true })).toHaveCount(
    0,
  );

  await openTab(page, "Categorias");
  await expect(
    page.getByRole("article").filter({ hasText: "Casa" }),
  ).toContainText("R$ 400,00");
  await expect(
    page.getByRole("article").filter({ hasText: "Alimentação" }),
  ).toContainText("R$ 0,00");

  await openTab(page, "Limites");
  await expect(limitItem(page, "Casa")).toContainText("R$ 400,00 gastos");
  await expect(limitItem(page, "Alimentação")).toContainText("R$ 0,00 gastos");

  await page.getByLabel("Mês anterior").click();
  await openTab(page, "Início");
  await expect(metric(page, "Orçamento mensal")).toContainText("R$ 1.100,00");
  await expect(metric(page, "Gasto até agora")).toContainText("R$ 300,00");
  await expect(page.getByText("Mercado agosto", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Mercado agosto", { exact: true })).toBeVisible();
  await expect(metric(page, "Saldo disponível")).toContainText("R$ 800,00");
});

test("limites pessoais usam buckets explícitos e recalculam pela UI @desktop", async ({
  page,
}) => {
  await openWithFinancialState(
    page,
    createFinancialState({
      expenses: [
        {
          id: 1,
          title: "FIES",
          amount: 553.2,
          cat: "Educação",
          who: "Bruna",
          date: "2026-08-05",
        },
        {
          id: 2,
          title: "Mercado da casa",
          amount: 50,
          cat: "Alimentação",
          who: "Bruna",
          date: "2026-08-06",
        },
        {
          id: 3,
          title: "Unha",
          amount: 60,
          cat: "Pessoal",
          who: "Bruna",
          date: "2026-08-07",
          personalLimitBucket: "bruna_nails",
        },
        {
          id: 4,
          title: "Almoço individual",
          amount: 70,
          cat: "Alimentação",
          who: "Bruna",
          date: "2026-08-08",
          personalLimitBucket: "bruna_personal",
        },
        {
          id: 5,
          title: "Cabelo Matheus",
          amount: 80,
          cat: "Pessoal",
          who: "Matheus",
          date: "2026-08-09",
          personalLimitBucket: "matheus_personal",
        },
      ],
    }),
  );

  await openTab(page, "Gastos");
  await expect(page.getByText("FIES", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Mercado da casa", { exact: true }),
  ).toBeVisible();

  await openTab(page, "Limites");
  await expect(limitItem(page, "Bruna — Total pessoal")).toContainText(
    "R$ 130,00 gastos",
  );
  await expect(limitItem(page, "Bruna — Unha")).toContainText(
    "R$ 60,00 gastos",
  );
  await expect(limitItem(page, "Bruna — Pessoal")).toContainText(
    "R$ 70,00 gastos",
  );
  await expect(limitItem(page, "Educação")).toContainText("R$ 553,20 gastos");
  await expect(limitItem(page, "Alimentação")).toContainText(
    "R$ 120,00 gastos",
  );

  await openTab(page, "Início");
  await expect(metric(page, "Gasto até agora")).toContainText("R$ 733,20");

  await openTab(page, "Gastos");
  await page.getByLabel("Editar Almoço individual").click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Usar limite pessoal").selectOption("bruna_nails");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await openTab(page, "Limites");
  await expect(limitItem(page, "Bruna — Total pessoal")).toContainText(
    "R$ 130,00 gastos",
  );
  await expect(limitItem(page, "Bruna — Unha")).toContainText(
    "R$ 130,00 gastos",
  );
  await expect(limitItem(page, "Bruna — Pessoal")).toContainText(
    "R$ 0,00 gastos",
  );

  await openTab(page, "Gastos");
  await page.getByLabel("Editar Almoço individual").click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Usar limite pessoal").selectOption("");
  await dialog.getByRole("button", { name: "Salvar gasto" }).click();
  await page.getByLabel("Excluir Unha").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir gasto" })
    .click();
  await openTab(page, "Limites");
  await expect(limitItem(page, "Bruna — Total pessoal")).toContainText(
    "R$ 0,00 gastos",
  );
  await expect(limitItem(page, "Bruna — Unha")).toContainText("R$ 0,00 gastos");
  await expect(limitItem(page, "Bruna — Pessoal")).toContainText(
    "R$ 0,00 gastos",
  );
  await expect(limitItem(page, "Alimentação")).toContainText(
    "R$ 120,00 gastos",
  );

  await page.getByRole("button", { name: "Matheus", exact: true }).click();
  await expect(limitItem(page, "Matheus — Pessoal")).toContainText(
    "R$ 80,00 gastos",
  );
});

test("adiantar parcelas preserva o cancelamento, competências e reload @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page);
  await openTab(page, "Futuro");
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Notebook");
  await dialog.getByLabel("Valor mensal").fill("10000");
  await dialog.getByLabel("Total de parcelas").fill("4");
  await dialog.getByRole("button", { name: "Salvar parcela" }).click();
  await expect(page.getByText("4 restantes", { exact: true })).toBeVisible();
  await expect(page.getByText("Próximo: 10/09", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Adiantar" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("4 restantes", { exact: true })).toBeVisible();
  await expect(page.getByText("Próximo: 10/09", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Adiantar" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantas parcelas deseja adiantar?").fill("2");
  await dialog.getByRole("button", { name: "Confirmar adianto" }).click();
  await expect(page.getByText("2 pagas", { exact: true })).toBeVisible();
  await expect(page.getByText("2 restantes", { exact: true })).toBeVisible();
  await expect(page.getByText("Próximo: 10/11", { exact: true })).toBeVisible();

  await page.getByLabel("Próximo mês").click();
  await expect(
    page.getByText("Nenhum compromisso vence neste mês."),
  ).toBeVisible();
  await page.getByLabel("Próximo mês").click();
  await expect(page.getByText("Notebook", { exact: true })).toBeVisible();
  await page.reload();
  await openTab(page, "Futuro");
  await expect(page.getByText("Notebook", { exact: true })).toBeVisible();
  await expect(page.getByText("2 restantes", { exact: true })).toBeVisible();
});

test("entradas extras criam, editam, excluem e reconciliam totais pela UI @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page, createFinancialState({ income: 1_000 }));
  await openTab(page, "Entradas & extras");
  await expect(page.getByText("R$ 1.000,00", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Nova entrada" }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Entrada", exact: true })
    .fill("Bônus");
  await dialog.getByLabel("Valor").fill("25000");
  await dialog.getByRole("button", { name: "Salvar entrada" }).click();
  await expect(page.getByText("Bônus", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: "Entradas extras" }),
  ).toContainText("R$ 250,00");
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Total disponível antes dos gastos" }),
  ).toContainText("R$ 1.250,00");

  await page.reload();
  await openTab(page, "Entradas & extras");
  await expect(page.getByText("Bônus", { exact: true })).toBeVisible();
  await page.getByLabel("Editar entrada Bônus").click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor").fill("30000");
  await dialog.getByRole("button", { name: "Salvar entrada" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Entradas extras" }),
  ).toContainText("R$ 300,00");
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Total disponível antes dos gastos" }),
  ).toContainText("R$ 1.300,00");

  await page.getByLabel("Excluir entrada Bônus").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir entrada" })
    .click();
  await expect(page.getByText("Bônus", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("article").filter({ hasText: "Entradas extras" }),
  ).toContainText("R$ 0,00");
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Total disponível antes dos gastos" }),
  ).toContainText("R$ 1.000,00");
});
