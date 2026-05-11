import { expect, test } from "@playwright/test";
import { pickFirstComboboxOption } from "./helpers/combobox";
import { loginDemo } from "./helpers/demo-auth";

test.describe("ventas — madera, aserradero, mixer (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("madera cortada: venta básica aparece en listado", async ({ page }) => {
    await page.goto("/ventas/madera-cortada");
    await expect(page.getByRole("heading", { name: "Madera cortada", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Vender madera cortada" }).click();
    await expect(page.getByRole("heading", { name: "Nueva venta de madera cortada" })).toBeVisible();

    await pickFirstComboboxOption(page, /Cliente para venta de madera cortada/, "Ropero");
    await page.getByLabel("Tipo de entrega").selectOption("entrega_local");
    await page.getByLabel("Precio por PT (S/)").fill("25");
    await page.getByRole("button", { name: "Confirmar venta" }).click();

    await expect(page.getByRole("heading", { name: "Madera cortada", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Ropero Carlos" }).first()).toBeVisible();
  });

  test("aserradero: servicio básico aparece en listado", async ({ page }) => {
    await page.goto("/ventas/aserradero-servicios");
    await expect(page.getByRole("heading", { name: "Servicio aserradero" })).toBeVisible();
    await page.getByRole("button", { name: "Registrar servicio" }).first().click();
    await expect(page.getByRole("heading", { name: "Nuevo servicio de aserradero" })).toBeVisible();

    await pickFirstComboboxOption(page, /Cliente para servicio de aserradero/, "Ropero");
    await page.getByRole("button", { name: "Registrar servicio" }).last().click();

    await expect(page.getByRole("heading", { name: "Servicio aserradero" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Ropero Carlos" }).first()).toBeVisible();
  });

  test("alquiler mixer: contrato básico aparece en tabla", async ({ page }) => {
    const codigo = `CT-E2E-${Date.now()}`;
    await page.goto("/ventas/alquiler-mixer");
    await expect(page.getByRole("heading", { name: "Alquiler Bomba Mixer" })).toBeVisible();
    await page.getByRole("button", { name: "Nuevo contrato" }).click();
    await expect(page.getByRole("heading", { name: "Contrato de alquiler" })).toBeVisible();

    await pickFirstComboboxOption(page, /Cliente para contrato de alquiler/, "Mixer");
    await page.getByLabel("Código de contrato").fill(codigo);
    await page.getByLabel("Activo / equipo").fill("Bomba Mixer E2E");
    await page.getByLabel("Representante de la empresa").fill("Resp. prueba");
    await page.getByLabel("RUC de la empresa").fill("20601234567");
    await page.getByLabel("Dirección de ejecución de obra").fill("Obra prueba E2E");
    await page.getByLabel("Fecha de término estimada").fill("2026-12-31");
    await page.getByLabel("Tarifa (S/)").clear();
    await page.getByLabel("Tarifa (S/)").pressSequentially("80");
    await page.getByLabel("Cantidad de unidades").clear();
    await page.getByLabel("Cantidad de unidades").pressSequentially("2");
    await expect(page.locator('input[name="monto_total"]')).toHaveValue("160.00");
    await page.getByRole("button", { name: "Registrar contrato" }).click();

    await expect(page.getByRole("heading", { name: "Alquiler Bomba Mixer" })).toBeVisible();
    await expect(page.getByRole("cell", { name: codigo })).toBeVisible();
  });
});
