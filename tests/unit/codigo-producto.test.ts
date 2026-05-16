import { previsualizarCodigo, analizarNombre } from "@/lib/codigo-producto";

describe("previsualizarCodigo", () => {
  test("retorna null para nombre vacío", () => {
    expect(previsualizarCodigo("")).toBeNull();
    expect(previsualizarCodigo("   ")).toBeNull();
  });

  test("retorna código con prefijo MAD para madera", () => {
    const codigo = previsualizarCodigo("Madera de cedro");
    expect(codigo).toContain("MAD");
  });

  test("retorna código con prefijo CLA para clavo", () => {
    const codigo = previsualizarCodigo("Clavo de acero 3 pulgadas");
    expect(codigo).toContain("CLA");
  });

  test("el código tiene el formato PREFIJO-SUBCAT-YYMM-###", () => {
    const codigo = previsualizarCodigo("Tornillo hexagonal");
    // Formato: CAT-SUB-YYMM-### (el YYMM puede variar por locale del sistema)
    expect(codigo).toMatch(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,6}-###$/);
  });

  test("genera código incluso para nombres sin match en diccionario", () => {
    const codigo = previsualizarCodigo("Producto desconocido XYZ");
    expect(codigo).not.toBeNull();
    expect(codigo).toContain("###");
  });
});

describe("analizarNombre", () => {
  test("retorna esMatch=false para nombre vacío", () => {
    const result = analizarNombre("");
    expect(result.esMatch).toBe(false);
    expect(result.codigo).toBeNull();
  });

  test("retorna esMatch=true para barniz", () => {
    const result = analizarNombre("Barniz transparente");
    expect(result.esMatch).toBe(true);
    expect(result.cat).toBe("BAR");
  });

  test("retorna esMatch=false para producto desconocido", () => {
    const result = analizarNombre("Producto sin categoria conocida");
    expect(result.esMatch).toBe(false);
  });

  test("retorna código también para productos sin match", () => {
    const result = analizarNombre("Objeto raro sin match");
    expect(result.codigo).not.toBeNull();
  });
});
