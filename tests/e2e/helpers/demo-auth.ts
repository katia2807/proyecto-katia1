import { expect, type Page } from "@playwright/test";

export const DEMO_EMAIL = "test@test.com";
export const DEMO_PASSWORD = "test1234";

export async function loginDemo(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(DEMO_EMAIL);
  await page.getByLabel(/^Contraseña$/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page.getByRole("heading", { name: "Inicio", exact: true, level: 2 })).toBeVisible({
    timeout: 25_000,
  });
  await page.getByRole("button", { name: "Saltar tour" }).click();
}
