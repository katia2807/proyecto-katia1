import { expect, test } from "@playwright/test";
import { loginDemo } from "./helpers/demo-auth";

async function openNuevoMovimientoCaja(page: import("@playwright/test").Page) {
  await page.goto("/caja");
  await expect(page.getByRole("heading", { name: "Caja chica" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar movimiento" }).first().click();
  await expect(page.getByRole("heading", { name: "Nuevo movimiento de caja" })).toBeVisible();
}

test.describe("caja (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("registra ingreso y aparece en la lista", async ({ page }) => {
    const marca = `e2e-ingreso-${Date.now()}`;
    await openNuevoMovimientoCaja(page);
    await page.getByLabel("Tipo").selectOption("ingreso");
    await page.getByLabel("Fecha").fill("2026-05-10");
    await page.getByLabel("Categoría").fill(marca);
    await page.getByLabel("Monto (S/)").fill("77.5");
    await page.getByRole("button", { name: "Registrar movimiento" }).last().click();
    await expect(page.getByRole("heading", { name: "Caja chica" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: marca });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "ingreso", exact: true })).toBeVisible();
  });

  test("registra egreso y aparece en la lista", async ({ page }) => {
    const marca = `e2e-egreso-${Date.now()}`;
    await openNuevoMovimientoCaja(page);
    await page.getByLabel("Tipo").selectOption("egreso");
    await page.getByLabel("Fecha").fill("2026-05-10");
    await page.getByLabel("Categoría").fill(marca);
    await page.getByLabel("Monto (S/)").fill("33.25");
    await page.getByRole("button", { name: "Registrar movimiento" }).last().click();
    await expect(page.getByRole("heading", { name: "Caja chica" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: marca });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "egreso", exact: true })).toBeVisible();
  });
});
