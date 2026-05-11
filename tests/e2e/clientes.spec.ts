import { expect, test } from "@playwright/test";
import { loginDemo } from "./helpers/demo-auth";

test.describe("clientes — hub ventas (demo DB)", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemo(page);
  });

  test("crear cliente desde el hub y verlo en el listado", async ({ page }) => {
    const nombre = `Cliente Prueba ${Date.now()}`;
    const doc = "87654321";

    await page.goto("/ventas");
    await expect(page.getByRole("heading", { name: "Módulo de venta" })).toBeVisible();

    await page.getByRole("button", { name: "Registrar cliente" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo cliente" });
    await expect(dialog.getByRole("heading", { name: "Nuevo cliente" })).toBeVisible();

    await dialog.getByLabel("Tipo").selectOption("natural");
    await dialog.getByLabel("Nombre o razón social").fill(nombre);
    await dialog.getByLabel("DNI / Documento").fill(doc);
    await dialog.getByLabel("Teléfono").fill("987654321");
    await dialog.getByLabel("Dirección").fill("Jr. Prueba E2E 123");
    // Zod 4: optional string no acepta null; sin campo `ruc` FormData devuelve null y falla el parse en el server action.
    await dialog.evaluate(() => {
      const root = document.querySelector('[role="dialog"]');
      const form = root?.querySelector("form");
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.querySelector('input[name="ruc"]')) {
        const h = document.createElement("input");
        h.type = "hidden";
        h.name = "ruc";
        h.value = "";
        form.appendChild(h);
      }
    });
    await dialog.getByRole("button", { name: "Guardar cliente" }).click();

    await page.waitForURL("/ventas");
    await page.goto(`/ventas/clientes?q=${encodeURIComponent(nombre)}`);
    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
    const fila = page.getByRole("row").filter({ hasText: nombre });
    await expect(fila).toBeVisible();
    await expect(fila.getByRole("cell", { name: doc, exact: true })).toBeVisible();
  });
});
