import { expect, type Page, test } from "@playwright/test";

const e2eEmail = process.env.E2E_LOGIN_EMAIL;
const e2ePassword = process.env.E2E_LOGIN_PASSWORD;

async function loginWithSupabase(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(e2eEmail!);
  await page.getByLabel(/^Contraseña$/i).fill(e2ePassword!);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();
}

test.describe("critical path (Supabase Auth)", () => {
  test.beforeEach(({ }, testInfo) => {
    if (!e2eEmail || !e2ePassword) {
      testInfo.skip(true, "Define E2E_LOGIN_EMAIL y E2E_LOGIN_PASSWORD (usuario en Supabase Auth + perfiles).");
    }
  });

  test("dashboard and modules render in critical path", async ({ page }) => {
    await loginWithSupabase(page);
    await expect(page.getByRole("heading", { name: "Resumen operativo" })).toBeVisible();

    await page.goto("/caja");
    await expect(page.getByRole("heading", { name: "Caja chica" })).toBeVisible();

    await page.goto("/ventas");
    await expect(page.getByRole("heading", { name: "Módulo de venta" })).toBeVisible();

    await page.goto("/ventas/muebles-personalizados");
    await expect(
      page.getByRole("heading", { name: "Muebles personalizados" }),
    ).toBeVisible();

    await page.goto("/ventas/alquiler-mixer");
    await expect(page.getByRole("heading", { name: "Alquiler Bomba Mixer" })).toBeVisible();

    await page.goto("/personal");
    await expect(page.getByRole("heading", { name: "Gestión de personal" })).toBeVisible();

    await page.goto("/reportes");
    await expect(page.getByRole("heading", { name: "Reportes gerenciales" })).toBeVisible();

    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: "Cuenta administradora" })).toBeVisible();
  });

  test("client-like flow works with Supabase session", async ({ page }) => {
    await loginWithSupabase(page);
    await page.goto("/caja");
    await page.getByRole("button", { name: "Registrar movimiento" }).first().click();
    await page.getByLabel("Fecha").fill("2026-05-01");
    await page.getByLabel("Categoría").fill("prueba_e2e_caja");
    await page.getByLabel("Monto (S/)").fill("150");
    await page.getByRole("button", { name: "Registrar movimiento" }).last().click();
    await expect(page.getByText("prueba_e2e_caja").first()).toBeVisible();

    await page.goto("/ventas/muebles-personalizados");
    await page.getByRole("button", { name: "Nueva cotización" }).click();
    await page.locator('select[name="cliente_id"]').selectOption({ index: 1 });
    await page.getByLabel("Fecha").first().fill("2026-05-01");
    await page.getByLabel("Especie de madera").fill("Pino e2e");
    await page.getByLabel("Precio calculado (S/)").fill("120");
    await page.getByLabel("Precio acordado (S/)").fill("100");
    await page.locator("button").filter({ hasText: "Guardar cotización" }).click();
    await expect(page.getByText("Pino e2e").first()).toBeVisible();

    await page.goto("/reportes");
    await page.getByRole("button", { name: "Cerrar mes" }).click();
    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const token = `CERRAR MES ${yyyy}-${mm}`;
    await page.locator('input[name="anio"]').fill(yyyy);
    await page.locator('input[name="mes"]').fill(String(Number(mm)));
    await page.locator('input[name="confirmacion"]').fill(token);
    await page.locator('button[type="submit"]').filter({ hasText: "Cerrar mes" }).click();
    await expect(page.getByText("cerrado").first()).toBeVisible();
  });
});
