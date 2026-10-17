import { afterEach, describe, expect, test, vi } from "vitest";
import { isInicioResumenPreview } from "@/lib/inicio-resumen-preview";

afterEach(() => vi.unstubAllEnvs());

describe("Aislamiento de la propuesta de Inicio", () => {
  test.each([
    ["development", "1", "1", true],
    ["development", "true", "1", true],
    ["development", "yes", "1", true],
    ["production", "1", "1", false],
    ["test", "1", "1", false],
    ["development", "0", "1", false],
    ["development", undefined, "1", false],
    ["development", "1", "0", false],
    ["development", "1", undefined, false],
  ] as const)("modo=%s demo=%s propuesta=%s → %s", (mode, demo, preview, expected) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("KATIA_USE_DEMO_DB", demo);
    vi.stubEnv("KATIA_INICIO_PREVIEW", preview);
    expect(isInicioResumenPreview()).toBe(expected);
  });
});
