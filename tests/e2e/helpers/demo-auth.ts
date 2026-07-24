import { expect, type Page } from "@playwright/test";

export const DEMO_EMAIL = "test@test.com";
export const DEMO_PASSWORD = "test1234";

export async function loginDemo(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(DEMO_EMAIL);
  await page.getByLabel(/^Contraseña$/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page.getByRole("link", { name: "Ventas", exact: true })).toBeVisible({
    timeout: 25_000,
  });
  const skipTour = page.getByRole("button", { name: "Saltar tour" });
  if (await skipTour.isVisible()) {
    await skipTour.click();
  }
}
