import { describe, test, expect } from "vitest";
import { parseDecimal, parseDecimalOptional, decimalSchema } from "@/lib/utils";

describe("parseDecimal", () => {
  test("debería parsear coma decimal peruana", () => {
    expect(parseDecimal("1,70")).toBe(1.70);
    expect(parseDecimal("1200,50")).toBe(1200.50);
  });

  test("debería parsear punto decimal estándar", () => {
    expect(parseDecimal("1.70")).toBe(1.70);
    expect(parseDecimal("1200.50")).toBe(1200.50);
  });

  test("debería soportar miles si existen", () => {
    expect(parseDecimal("1,200.50")).toBe(1200.50);
    expect(parseDecimal("1.200,50")).toBe(1200.50);
  });

  test("debería eliminar S/ y espacios", () => {
    expect(parseDecimal("S/ 1,200.50")).toBe(1200.50);
    expect(parseDecimal("S/ 1200,50")).toBe(1200.50);
    expect(parseDecimal("s/1,200.50")).toBe(1200.50);
    expect(parseDecimal("S/. 1,200.50")).toBe(1200.50);
  });

  test("debería retornar 0 ante valores vacíos o inválidos", () => {
    expect(parseDecimal("")).toBe(0);
    expect(parseDecimal(null)).toBe(0);
    expect(parseDecimal(undefined)).toBe(0);
    expect(parseDecimal("abc")).toBe(0);
  });
});

describe("parseDecimalOptional", () => {
  test("debería retornar undefined si está vacío", () => {
    expect(parseDecimalOptional("")).toBeUndefined();
    expect(parseDecimalOptional(null)).toBeUndefined();
    expect(parseDecimalOptional(undefined)).toBeUndefined();
  });

  test("debería retornar number si tiene valor válido", () => {
    expect(parseDecimalOptional("1200,50")).toBe(1200.50);
  });
});

describe("decimalSchema", () => {
  test("campo requerido con mensaje claro", () => {
    const schema = decimalSchema("Precio");
    const res = schema.safeParse("");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain("El campo Precio es requerido.");
    }
  });

  test("campo opcional acepta vacío", () => {
    const schema = decimalSchema("Precio", { optional: true });
    const res = schema.safeParse("");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toBeUndefined();
    }
  });
});
