import { expect, test, type Page } from "@playwright/test";
import { pickFirstComboboxOption } from "./helpers/combobox";
import { loginDemo } from "./helpers/demo-auth";

function parseStockLabel(text: string | null): number {
  const m = text?.match(/Stock:?\s*([\d.]+)/);
  return m ? Number(m[1]) : NaN;
}

async function stockTablaTornillo(page: Page): Promise<number> {
  await page.getByRole("button", { name: "Productos" }).click();
  const productRow = page.getByRole("checkbox", { name: /^Seleccionar Tabla Tornillo/ }).locator("..");
  await expect(productRow).toContainText("MAD-TOR-01");
  const label = await productRow.getByText(/Stock:?\s*[\d.]+/).textContent();
  return parseStockLabel(label);
}

test.describe("inventario (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("entrada por compra aumenta el stock del producto", async ({ page }) => {
    await page.goto("/inventario");
    await expect(page.getByRole("heading", { name: "Inventario", exact: true, level: 2 })).toBeVisible();

    const antes = await stockTablaTornillo(page);

    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Movimiento de inventario" });
    await expect(dialog.getByRole("heading", { name: "Movimiento de inventario" })).toBeVisible();

    await pickFirstComboboxOption(page, /Producto para movimiento de inventario/, "Tabla Tornillo");
    await dialog.getByLabel("Fecha").fill("2026-05-11");
    await dialog.getByLabel("Cantidad").fill("1");
    await dialog.getByLabel("Referencia").fill(`E2E-inv-${Date.now()}`);
    await dialog.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Inventario", exact: true, level: 2 })).toBeVisible();

    const despues = await stockTablaTornillo(page);
    expect(despues).toBeCloseTo(antes + 1, 5);
  });
});
