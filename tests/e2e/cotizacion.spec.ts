import { expect, test } from "@playwright/test";
import { pickFirstComboboxOption } from "./helpers/combobox";
import { loginDemo } from "./helpers/demo-auth";

test.describe("cotización unificada (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("crea cotización aserradero, guarda y muestra correlativo N°…", async ({ page }) => {
    await page.goto("/cotizacion");
    await expect(page.getByRole("heading", { name: "Cotización", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Empresa" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await pickFirstComboboxOption(page, /Cliente existente/, "Inversiones");
    await expect(page.getByRole("heading", { name: "Datos del cliente" })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.locator("select").filter({ has: page.locator('option[value="aserradero"]') }).selectOption("aserradero");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: "Aserradero — mano de obra" })).toBeVisible();
    await page.locator("label", { hasText: "S/ por hora (definís vos)" }).locator("input").fill("120");
    await page.locator("label", { hasText: /^Horas$/ }).locator("input").fill("2");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: "Vista previa — cotización formal" })).toBeVisible();
    await expect(page.getByText(/Correlativo mostrado:/)).toBeVisible();

    await page.getByRole("button", { name: "Guardar pendiente" }).click();

    await expect(page.getByRole("heading", { name: "Cotización", exact: true })).toBeVisible();
    const correlativoCell = page.getByRole("cell", { name: /^N°\d{4}$/ }).first();
    await expect(correlativoCell).toBeVisible();
    await expect(page.getByText("Inversiones Obra Sur").first()).toBeVisible();
  });
});
