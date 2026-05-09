import { expect, test } from "@playwright/test";

const email = process.env.E2E_STAGING_EMAIL;
const password = process.env.E2E_STAGING_PASSWORD;

test.describe("staging smoke", () => {
  test.skip(!email || !password, "Define E2E_STAGING_EMAIL y E2E_STAGING_PASSWORD para correr staging.");

  test("login real and create caja movimiento", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo/i).fill(email ?? "");
    await page.getByLabel(/^Contraseña$/i).fill(password ?? "");
    await page.getByRole("button", { name: "Ingresar al panel" }).click();
    await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();

    await page.goto("/caja");
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    await page.getByLabel("Fecha").fill("2026-05-01");
    await page.getByLabel("Categoría").fill("staging_e2e_caja");
    await page.getByLabel("Monto (S/)").fill("99");
    await page.getByRole("button", { name: "Registrar movimiento" }).nth(1).click();
    await expect(page.getByText("staging_e2e_caja").first()).toBeVisible();
  });
});
