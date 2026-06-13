import { describe, test, expect } from "vitest";
import { parseDecimal, parseDecimalOptional, decimalSchema, formatPen, roundMoney } from "@/lib/utils";

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

describe("money helpers", () => {
  test("redondea errores flotantes a centavos exactos", () => {
    expect(roundMoney(59.999999999)).toBe(60);
    expect(roundMoney(55.5)).toBe(55.5);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  test("formatea soles siempre con centavos", () => {
    expect(formatPen(59.999999999)).toContain("60.00");
    expect(formatPen(55.5)).toContain("55.50");
  });
});
