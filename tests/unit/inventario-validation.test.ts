import { inventarioCostoUnitarioOpcionalSchema } from "@/lib/inventario-validation";

describe("costo unitario opcional de inventario", () => {
  test("acepta el campo omitido", () => {
    expect(inventarioCostoUnitarioOpcionalSchema.parse(undefined)).toBeUndefined();
    expect(inventarioCostoUnitarioOpcionalSchema.parse(null)).toBeUndefined();
  });

  test('interpreta "" como ausencia de costo', () => {
    expect(inventarioCostoUnitarioOpcionalSchema.parse("")).toBeUndefined();
  });

  test("interpreta una cadena de espacios como ausencia de costo", () => {
    expect(inventarioCostoUnitarioOpcionalSchema.parse("   ")).toBeUndefined();
  });

  test("normaliza un costo monetario válido", () => {
    expect(inventarioCostoUnitarioOpcionalSchema.parse("12.34")).toBe(12.34);
  });

  test("conserva cero explícito", () => {
    expect(inventarioCostoUnitarioOpcionalSchema.parse("0")).toBe(0);
  });

  test("rechaza un valor no vacío inválido", () => {
    expect(inventarioCostoUnitarioOpcionalSchema.safeParse("abc").success).toBe(false);
    expect(inventarioCostoUnitarioOpcionalSchema.safeParse("12abc").success).toBe(false);
  });

  test("admite coma decimal mediante el parser existente", () => {
    expect(inventarioCostoUnitarioOpcionalSchema.parse("12,34")).toBe(12.34);
  });
});
