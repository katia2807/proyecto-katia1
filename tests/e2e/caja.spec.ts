import { expect, test } from "@playwright/test";
import { loginDemo } from "./helpers/demo-auth";

async function openNuevoMovimientoCaja(page: import("@playwright/test").Page) {
  await page.goto("/caja");
  await expect(page.getByRole("heading", { name: "Caja", exact: true, level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Registrar movimiento" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento de caja" });
  await expect(dialog.getByRole("heading", { name: "Nuevo movimiento de caja" })).toBeVisible();
  return dialog;
}

test.describe("caja (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("registra ingreso y aparece en la lista", async ({ page }) => {
    const marca = `e2e-ingreso-${Date.now()}`;
    const dialog = await openNuevoMovimientoCaja(page);
    await dialog.locator('select[name="tipo"]').selectOption("ingreso");
    await dialog.getByLabel("Fecha").fill("2026-05-10");
    await dialog.getByLabel("Categoría").fill(marca);
    await dialog.getByLabel("Monto (S/)").fill("77.5");
    await dialog.getByRole("button", { name: "Registrar movimiento" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Caja", exact: true, level: 2 })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: marca });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "ingreso", exact: true })).toBeVisible();
  });

  test("registra egreso y aparece en la lista", async ({ page }) => {
    const marca = `e2e-egreso-${Date.now()}`;
    const dialog = await openNuevoMovimientoCaja(page);
    await dialog.locator('select[name="tipo"]').selectOption("egreso");
    await dialog.getByLabel("Fecha").fill("2026-05-10");
    await dialog.getByLabel("Categoría").fill(marca);
    await dialog.getByLabel("Monto (S/)").fill("33.25");
    await dialog.getByRole("button", { name: "Registrar movimiento" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Caja", exact: true, level: 2 })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: marca });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "egreso", exact: true })).toBeVisible();
  });
});
