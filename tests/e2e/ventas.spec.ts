import { expect, test } from "@playwright/test";
import { pickFirstComboboxOption } from "./helpers/combobox";
import { loginDemo } from "./helpers/demo-auth";

test.describe("ventas — madera, aserradero, mixer (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("madera cortada: el detalle registrado coincide en todos los comprobantes", async ({ page }) => {
    await page.goto("/ventas/madera-cortada");
    await expect(page.getByRole("heading", { name: "Madera cortada", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Registrar venta de madera" }).click();
    await expect(page.getByRole("heading", { name: "Registrar venta de madera", exact: true, level: 3 })).toBeVisible();

    await pickFirstComboboxOption(page, /Cliente para venta de madera cortada/, "Ropero");
    await page.getByRole("button", { name: /^Siguiente: Detalle del corte/ }).click();
    await expect(page.getByRole("heading", { name: "Paso 2: Detalle del corte y cubicaje", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Agregar pieza" }).click();
    await page.getByPlaceholder("Tabla, listón, especie...").fill("Tabla de roble selección E2E");
    await page.getByLabel("Cantidad").fill("4");
    await page.getByLabel("Espesor (in)").fill("1");
    await page.getByLabel("Ancho (in)").fill("1");
    await page.getByLabel("Largo (ft)").fill("12");
    await page.getByLabel("Precio por PT (S/)").fill("3.5");
    await page.locator("label").filter({ hasText: "Precio unit. S/" }).locator('input[type="number"]').fill("3.5");
    await page.getByRole("button", { name: /^Siguiente: Cobro y Entrega/ }).click();
    await expect(page.getByRole("heading", { name: "Paso 3: Resumen de cobro, entrega y pago", exact: true })).toBeVisible();
    await page.getByLabel("Tipo de entrega").selectOption("entrega_local");
    await page.getByRole("button", { name: /^Siguiente: Confirmar/ }).click();
    await expect(page.getByRole("heading", { name: "Paso 4: Confirmar y registrar", exact: true })).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Registrar venta ✓", exact: true }).click();
    const comprobante = await popupPromise;
    await comprobante.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { name: "Madera cortada", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Ropero Carlos" }).first()).toBeVisible();

    expect(comprobante.url()).toMatch(/\/ventas\/comprobante\/madera\/[0-9a-f-]+\?tipoComprobante=boleta/);
    const ventaId = comprobante.url().match(/\/madera\/([0-9a-f-]+)/)?.[1];
    expect(ventaId).toBeTruthy();

    for (const url of [
      `/ventas/comprobante/madera/${ventaId}?tipoComprobante=boleta`,
      `/print/a4/boleta/${ventaId}?tipo=madera`,
      `/print/ticket/boleta/${ventaId}?tipo=madera`,
    ]) {
      await comprobante.goto(url);
      await expect(comprobante.getByText(/Tabla de roble selección E2E/).first()).toBeVisible();
      await expect(comprobante.getByText(/1\" × 1\" × 12'/).first()).toBeVisible();
      await expect(comprobante.getByText(/4\s*pzs/i).first()).toBeVisible();
      await expect(comprobante.getByText(/S\/\s*3\.50/).first()).toBeVisible();
      await expect(comprobante.getByText(/S\/\s*14\.00/).last()).toBeVisible();
      await expect(comprobante.locator("body")).not.toContainText("93.33");
    }

    await comprobante.close();
  });

  test("aserradero: servicio básico aparece en listado", async ({ page }) => {
    await page.goto("/ventas/aserradero-servicios");
    await expect(page.getByRole("heading", { name: "Servicio aserradero" })).toBeVisible();
    await page.getByRole("button", { name: "Registrar servicio" }).first().click();
    await expect(page.getByRole("heading", { name: "Nuevo servicio de aserradero" })).toBeVisible();

    await expect(page.getByRole("button", { name: /Agregar servicio adicional/ })).toHaveAttribute("aria-expanded", "false");
    await page.getByLabel("Espesor del bloque 1 en pulgadas").fill("11");
    await page.getByLabel("Ancho del bloque 1 en pulgadas").fill("5");
    await page.getByLabel("Largo del bloque 1 en pies").fill("14");
    await expect(page.getByLabel("PT comercial del bloque 1")).toHaveText("64");

    const tarifa = page.getByLabel("Tarifa de corte por PT");
    const totalCobrar = page.getByLabel("Total a cobrar");
    await expect(tarifa).toHaveValue("0.50");
    await expect(totalCobrar).toHaveValue("32.00");
    await tarifa.fill("0.60");
    await expect(totalCobrar).toHaveValue("38.40");
    await totalCobrar.fill("30.00");
    await tarifa.fill("0.50");
    await expect(totalCobrar).toHaveValue("30.00");
    await page.getByRole("button", { name: "Usar total calculado" }).click();
    await expect(totalCobrar).toHaveValue("32.00");

    await page.getByRole("button", { name: "Siguiente: Cliente y pago" }).click();
    await pickFirstComboboxOption(page, /Cliente para servicio de aserradero/, "Ropero");
    await page.getByRole("button", { name: "Siguiente: Confirmar" }).click();
    await expect(page.getByText("Total a cobrar", { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Registrar servicio" }).last().click();
    await expect(page.getByText("Servicio de aserradero registrado correctamente.")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Servicio aserradero" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Ropero Carlos" }).first()).toBeVisible();

    const serviceRow = page.getByRole("row").filter({ hasText: "Ropero Carlos" }).first();
    const previewHref = await serviceRow.getByTitle("Imprimir comprobante").getAttribute("href");
    expect(previewHref).toBeTruthy();
    const serviceId = previewHref!.split("/aserradero/")[1]!.split("?")[0]!;

    await page.goto(previewHref!);
    await expect(page.getByText("Ropero Carlos", { exact: true })).toBeVisible();
    await expect(page.getByText("64 PT", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("S/ 0.50", { exact: true })).toBeVisible();
    await expect(page.getByText("S/ 32.00", { exact: true }).last()).toBeVisible();

    await page.goto(`/print/a4/boleta/${serviceId}?tipo=aserradero`);
    await expect(page.getByText("Ropero Carlos", { exact: true })).toBeVisible();
    await expect(page.getByText("64 PT", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("S/ 0.50", { exact: true })).toBeVisible();
    await expect(page.getByText("S/ 32.00", { exact: true }).last()).toBeVisible();

    await page.goto(`/print/ticket/boleta/${serviceId}?tipo=aserradero`);
    await expect(page.getByText("Medidas: esp(in) ancho(in) largo(ft)")).toBeVisible();
    await expect(page.getByText(/#01 11 5 14/)).toBeVisible();
    await expect(page.getByText("64 PT", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("S/ 0.50", { exact: true })).toBeVisible();
    await expect(page.getByText("S/ 32.00", { exact: true }).last()).toBeVisible();
  });

  test("alquiler mixer: contrato básico aparece en tabla", async ({ page }) => {
    const codigo = `CT-E2E-${Date.now()}`;
    await page.goto("/ventas/alquiler-mixer");
    await expect(page.getByRole("heading", { name: "Alquiler Bomba Mixer" })).toBeVisible();
    await page.getByRole("button", { name: "Nuevo contrato" }).click();
    const dialog = page.getByRole("dialog", { name: "Contrato de alquiler" });
    await expect(dialog.getByRole("heading", { name: "Contrato de alquiler", exact: true })).toBeVisible();

    await pickFirstComboboxOption(page, /Cliente para contrato de alquiler/, "Mixer");
    await page.getByLabel("Código de contrato").fill(codigo);
    await page.getByRole("button", { name: /^Siguiente: Datos del Activo/ }).click();
    await expect(page.getByRole("heading", { name: "Paso 2: Datos del activo", exact: true })).toBeVisible();
    await page.locator('select[name="activo"]').selectOption({ index: 0 });
    await page.getByLabel("Representante de la empresa").fill("Resp. prueba");
    await page.getByLabel("RUC de la empresa").fill("20601234567");
    await page.getByLabel("Dirección de ejecución de obra").fill("Obra prueba E2E");
    await page.getByRole("button", { name: /^Siguiente: Fechas y tarifa/ }).click();
    await expect(page.getByRole("heading", { name: "Paso 3: Fechas y tarifa", exact: true })).toBeVisible();
    await page.getByLabel("Fecha de término estimada").fill("2026-12-31");
    await page.getByRole("spinbutton", { name: "Tarifa (S/ por hora)", exact: true }).fill("80");
    await page.getByRole("spinbutton", { name: "Cantidad de horas", exact: true }).fill("2");
    await expect(page.locator('input[name="monto_total"]')).toHaveValue("160.00");
    await page.getByRole("button", { name: /^Siguiente: Resumen y confirmar/ }).click();
    await expect(page.getByRole("heading", { name: "Paso 4: Resumen y confirmar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Crear contrato" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Alquiler Bomba Mixer" })).toBeVisible();
    await expect(page.getByRole("cell", { name: codigo })).toBeVisible();
  });
});
