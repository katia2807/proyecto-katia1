import { expect, test } from "@playwright/test";

const email = process.env.E2E_STAGING_EMAIL;
const password = process.env.E2E_STAGING_PASSWORD;

test.describe("staging smoke — Katia Suite v1.0", () => {
  test.skip(!email || !password, "Define E2E_STAGING_EMAIL y E2E_STAGING_PASSWORD para correr staging.");

  test("health check endpoint responde ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("katia-suite");
  });

  test("login y navegación básica funciona", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo/i).fill(email ?? "");
    await page.getByLabel(/^Contraseña$/i).fill(password ?? "");
    await page.getByRole("button", { name: "Ingresar al panel" }).click();
    await page.waitForURL("**/");

    // Centro de Mando
    await page.goto("/gerencial");
    await expect(page.getByRole("heading", { name: "Centro de Mando" })).toBeVisible();

    // Caja
    await page.goto("/caja");
    await expect(page.getByRole("heading", { name: "Caja" })).toBeVisible();

    // Inventario
    await page.goto("/inventario");
    await expect(page.locator("h2")).toBeVisible();

    // Cotizaciones
    await page.goto("/cotizacion");
    await expect(page.getByRole("heading", { name: "Cotizaciones" })).toBeVisible();

    // Configuración
    await page.goto("/configuracion");
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
  });

  test("registrar movimiento de caja (smoke test operativo)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo/i).fill(email ?? "");
    await page.getByLabel(/^Contraseña$/i).fill(password ?? "");
    await page.getByRole("button", { name: "Ingresar al panel" }).click();
    await page.waitForURL("**/");

    await page.goto("/caja");
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    await page.getByLabel("Fecha").fill("2026-05-26");
    await page.getByLabel("Categoría").fill("staging_e2e_katia_v1");
    await page.getByLabel("Monto (S/)").fill("1");
    await page.getByRole("button", { name: "Registrar movimiento" }).nth(1).click();
    await expect(page.getByText("staging_e2e_katia_v1").first()).toBeVisible();
  });
});
