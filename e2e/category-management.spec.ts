import { expect, test } from "@playwright/test";
import {
  createFinancialState,
  openWithFinancialState,
} from "./helpers/financialState";

async function openCategories(page: import("@playwright/test").Page) {
  await page
    .getByRole("button", { name: "Categorias", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Categorias", exact: true })
    .waitFor();
}

test("exclusão de categoria elegível exige confirmação e preserva o guard de histórico @desktop", async ({
  page,
}) => {
  await openWithFinancialState(page, createFinancialState());
  await openCategories(page);

  await page.getByLabel("Nova categoria").fill("Viagem temporária");
  await page.getByRole("button", { name: "Criar categoria" }).click();
  const row = page.locator("li").filter({ hasText: "Viagem temporária" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Excluir" }).click();
  const confirmation = page.getByRole("dialog");
  await expect(
    confirmation.getByRole("heading", { name: "Excluir categoria" }),
  ).toBeVisible();
  await expect(confirmation).toContainText("Viagem temporária");
  await expect(row).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Cancelar" }),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: "Excluir" })).toBeFocused();

  await row.getByRole("button", { name: "Excluir" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Excluir" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir categoria" })
    .click();
  await expect(
    page.getByText("Viagem temporária", { exact: true }),
  ).toHaveCount(0);

  const usedCategory = page.locator("li").filter({ hasText: /^Alimentação/ });
  await expect(
    usedCategory.getByRole("button", { name: "Excluir" }),
  ).toBeDisabled();
});
