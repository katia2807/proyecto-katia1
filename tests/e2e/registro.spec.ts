import { expect, test } from "@playwright/test";
import { pickFirstComboboxOption } from "./helpers/combobox";
import { loginDemo } from "./helpers/demo-auth";

test.describe("registro general (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("nuevo registro aparece en el historial", async ({ page }) => {
    const titulo = `Hecho E2E ${Date.now()}`;

    await page.goto("/registro");
    await expect(page.getByRole("heading", { name: "Registro general por categoría" })).toBeVisible();

    await page.getByRole("button", { name: "Nuevo registro" }).click();
    const dialog = page.getByRole("dialog", { name: "Registro rápido categorizado" });
    await expect(dialog.getByRole("heading", { name: "Registro rápido categorizado" })).toBeVisible();

    await pickFirstComboboxOption(page, /Categoría del registro/, "Madera");
    await dialog.getByLabel("Fecha").fill("2026-05-11");
    await dialog.getByLabel("Título").fill(titulo);
    await dialog.getByLabel("Detalle").fill("Detalle generado por Playwright.");
    await dialog.getByLabel("Monto (opcional)").fill("10.5");
    await dialog.getByRole("button", { name: "Guardar registro" }).click();

    await page.goto("/registro");
    await expect(page.getByRole("heading", { name: "Registro general por categoría" })).toBeVisible();
    await expect(page.getByRole("cell", { name: titulo })).toBeVisible();
  });
});
