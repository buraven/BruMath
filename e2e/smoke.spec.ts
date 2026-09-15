import { expect, test } from "@playwright/test";
import { openInvoices, openWithFinancialState } from "./helpers/financialState";

test("BruMath carrega Home e abre Faturas sem erro fatal @smoke", async ({
  page,
}) => {
  await openWithFinancialState(page);

  await expect(
    page.getByRole("button", { name: "Início" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assistente" }).first(),
  ).toBeVisible();

  await openInvoices(page);
  await expect(
    page.getByRole("button", { name: "Novo cartão" }).first(),
  ).toBeVisible();
});
