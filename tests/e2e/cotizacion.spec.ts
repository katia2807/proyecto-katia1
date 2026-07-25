import { expect, test } from "@playwright/test";
import { pickFirstComboboxOption } from "./helpers/combobox";
import { loginDemo } from "./helpers/demo-auth";

test.describe("cotización unificada (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("crea cotización aserradero, guarda y muestra correlativo N°…", async ({ page }) => {
    await page.goto("/cotizacion");
    await expect(page.getByRole("heading", { name: "Nueva venta guiada", exact: true, level: 2 })).toBeVisible();

    await page.getByRole("button", { name: "Empresa" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await pickFirstComboboxOption(page, /Cliente existente/, "Inversiones");
    await expect(page.getByRole("heading", { name: "Datos del cliente" })).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await page.getByRole("button", { name: /Servicio Aserradero/ }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: "Aserradero — mano de obra" })).toBeVisible();
    await page.locator("label", { hasText: "S/ por hora (definís vos)" }).locator("input").fill("120");
    await page.locator("label", { hasText: /^Horas$/ }).locator("input").fill("2");
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByRole("heading", { name: "Vista previa — cotización formal" })).toBeVisible();
    await expect(page.getByText(/Correlativo mostrado:/)).toBeVisible();
    await expect(page.getByRole("row", { name: /TOTAL S\/ 312\.00/ })).toBeVisible();
    await expect(page.getByText("Margen aplicado").locator("..")).toContainText("30.0%");

    await page.getByRole("button", { name: "Guardar cotización", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Nueva venta guiada", exact: true, level: 2 })).toBeVisible();
    const correlativoCell = page.getByRole("cell", { name: /^N°\d{4}$/ }).first();
    await expect(correlativoCell).toBeVisible();
    const historialRow = correlativoCell.locator("..");
    await expect(historialRow).toContainText("Inversiones Obra Sur");
    await expect(historialRow).toContainText("S/ 312.00");
    await expect(page.getByText("1 cotización registrada.", { exact: false })).toBeVisible();

    const correlativo = await correlativoCell.textContent();
    expect(correlativo).toMatch(/^N°\d{4}$/);
    const detalleGuardadas = page.locator("details").filter({
      hasText: "Informacion adicional: cotizaciones guardadas",
    });
    await detalleGuardadas.locator("summary").click();
    const filaGuardada = detalleGuardadas.locator("tbody tr").filter({ hasText: correlativo ?? "" });
    await expect(filaGuardada).toHaveCount(1);

    const popupPromise = page.waitForEvent("popup");
    await filaGuardada.getByRole("button", { name: "PDF", exact: true }).click();
    const documento = await popupPromise;
    await expect(documento.getByRole("row", { name: /TOTAL S\/ 312\.00/ })).toBeVisible();
  });
});
