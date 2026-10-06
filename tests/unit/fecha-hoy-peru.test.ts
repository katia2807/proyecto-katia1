import { afterEach, describe, expect, test, vi } from "vitest";
import { fechaHoyPeru } from "@/lib/utils";

afterEach(() => vi.useRealTimers());

describe("fecha inicial de calendario de Perú", () => {
  test.each([
    ["2026-10-06T00:00:00Z", "2026-10-05"],
    ["2026-10-06T04:59:59Z", "2026-10-05"],
    ["2026-10-06T05:00:00Z", "2026-10-06"],
    ["2026-10-06T21:00:00Z", "2026-10-06"],
    ["2027-01-01T02:00:00Z", "2026-12-31"],
    ["2024-03-01T04:59:59Z", "2024-02-29"],
    ["2026-01-02T05:00:00Z", "2026-01-02"],
  ])("para el instante %s corresponde %s", (instante, fecha) => {
    expect(fechaHoyPeru(new Date(instante))).toBe(fecha);
  });

  test("sin argumento usa el reloj actual, conservando el día de Perú durante la noche", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T02:00:00Z"));
    expect(fechaHoyPeru()).toBe("2026-10-05");
  });
});
