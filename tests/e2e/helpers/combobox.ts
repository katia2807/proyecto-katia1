import { expect, type Page } from "@playwright/test";

/**
 * Abre el Combobox por `aria-label` y elige la primera opción cuyo nombre coincide con `nameFragment`.
 * No usa `fill()` para filtrar (evita el estado “Sin resultados” del filtro en algunos flujos).
 */
export async function pickFirstComboboxOption(page: Page, ariaLabel: string | RegExp, nameFragment: string) {
  const input = page.getByLabel(ariaLabel);
  await expect(input).toBeVisible();
  await input.click();
  // El <ul> del Combobox cuelga del mismo contenedor `relative` que el input.
  const list = input.locator("..").locator("ul[role='listbox']");
  await expect(list).toBeVisible({ timeout: 10_000 });
  const esc = nameFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(esc, "i");
  const opt = list.locator('[role="option"]').filter({ hasText: rx }).first();
  await expect(opt).toBeVisible({ timeout: 10_000 });
  await opt.click();
}
