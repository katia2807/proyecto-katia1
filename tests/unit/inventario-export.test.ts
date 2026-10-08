import { beforeEach, describe, expect, test, vi } from "vitest";
import ExcelJS from "exceljs";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), data: vi.fn(), empresa: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireApiAuth: mocks.auth }));
vi.mock("@/lib/data", () => ({ getInventarioRobustoData: mocks.data }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: mocks.empresa }));

import { GET } from "@/app/(dashboard)/inventario/export/route";
import { getInventarioKardexExportHref } from "@/lib/inventario-historial";

const movimiento = (id: string, producto = "p1", tipo = "salida_venta") => ({
  id, fecha: "2026-10-06", producto_id: producto, producto_codigo: producto,
  producto_nombre: producto === "p1" ? "Tabla Tornillo" : "Barniz", categoria: "Prueba",
  tipo, cantidad: 1, impacto: tipo === "salida_venta" ? -1 : 1, costo_unitario: null, referencia: `Referencia ${id}`,
});
const producto = (id: string, nombre: string) => ({ id, nombre, codigo: id, categoria: "Prueba", unidad: "unidad",
  activo: true, stock_actual: 5, stock_minimo: 1, costo_unitario_promedio: 0, valor_stock: 0, vendido: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ context: { organizationId: "empresa-aislada" }, response: null });
  mocks.empresa.mockResolvedValue({ nombre: "Empresa de prueba" });
  mocks.data.mockResolvedValue({ productos: [producto("p1", "Tabla Tornillo"), producto("p2", "Barniz")],
    kardex: [movimiento("m1"), movimiento("m2", "p1", "entrada_compra"), movimiento("m3", "p2")],
    historialMovimientos: { cargados: 3, total: 3 } });
});

async function descargar(query: string) {
  const response = await GET(new Request(`https://katia.local${query}`));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  return { response, workbook };
}

describe("Descarga de Inventario: formato y alcance", () => {
  test("el título y el archivo conservan el día de Perú aunque UTC sea el siguiente", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T01:00:00.000Z"));
    try {
      const { response, workbook } = await descargar("/inventario/export?type=full");
      expect(response.headers.get("content-disposition")).toContain("katia-inventario-full-2026-10-07.xlsx");
      expect(workbook.getWorksheet("Stock Actual")!.getCell("A1").value).toContain("07 de octubre de 2026");
      expect(workbook.getWorksheet("Kardex")!.getCell("A1").value).toContain("07 de octubre de 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  test("el enlace filtrado genera Excel con solo las filas seleccionadas", async () => {
    const { response, workbook } = await descargar(getInventarioKardexExportHref("salida_venta", "p1"));
    expect(mocks.auth).toHaveBeenCalledWith(["owner_admin", "gerencia", "almacen", "ventas"]);
    expect(mocks.data).toHaveBeenCalledWith({ organizationId: "empresa-aislada", complete: true });
    expect(response.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toMatch(/\.xlsx"$/);
    const sheet = workbook.getWorksheet("Kardex")!;
    expect(sheet.getCell("A2").value).toContain("1 movimiento · Tipo: Salida venta · Producto: Tabla Tornillo");
    expect(sheet.getCell("A3").value).toBe("Fecha");
    expect(sheet.rowCount).toBe(4);
    expect(sheet.getCell("I4").value).toBe("Referencia m1");
  });

  test("exporta todas las coincidencias cargadas aunque superen las 200 filas de pantalla", async () => {
    const rows = Array.from({ length: 215 }, (_, i) => movimiento(String(i)));
    mocks.data.mockResolvedValue({ productos: [producto("p1", "Tabla Tornillo")], kardex: rows,
      historialMovimientos: { cargados: rows.length, total: rows.length } });
    const { workbook } = await descargar(getInventarioKardexExportHref("salida_venta", "p1"));
    const sheet = workbook.getWorksheet("Kardex")!;
    expect(sheet.rowCount).toBe(218);
    expect(sheet.getCell("I218").value).toBe("Referencia 214");
    expect(sheet.getCell("A2").value).toContain("215 movimientos");
  });

  test("advierte dentro del archivo cuando la carga no incluye todo el historial", async () => {
    const fixture = await mocks.data();
    fixture.historialMovimientos.total = 5200;
    mocks.data.mockResolvedValue(fixture);
    const { workbook } = await descargar("/inventario/export?type=full");
    expect(workbook.getWorksheet("Kardex")!.getCell("A2").value).toContain("3 de 5200");
    expect(workbook.getWorksheet("Stock Actual")!.getCell("A3").value).toContain("Historial parcial");
    expect(workbook.getWorksheet("Stock Actual")!.getCell("A4").value).toBe("Código");
    expect(workbook.getWorksheet("Stock Actual")!.getCell("A5").value).toBe("p1");
  });

  test("Reportes conserva la descarga sin filtros y un filtro vacío no incluye filas ajenas", async () => {
    const { workbook } = await descargar("/inventario/export?type=kardex");
    expect(workbook.getWorksheet("Kardex")!.rowCount).toBe(6);
    const empty = await descargar(getInventarioKardexExportHref("ajuste", "p1"));
    expect(empty.workbook.getWorksheet("Kardex")!.rowCount).toBe(3);
    expect(empty.workbook.getWorksheet("Kardex")!.getCell("A2").value).toContain("0 movimientos");
  });

  test("la consulta del reporte requiere sesión antes de cargar datos", async () => {
    mocks.auth.mockResolvedValue({ context: null, response: new Response("Sin sesión", { status: 401 }) });
    expect((await GET(new Request("https://katia.local/inventario/export?type=kardex"))).status).toBe(401);
    expect(mocks.data).not.toHaveBeenCalled();
  });

  test("un rol sin acceso al inventario no puede descargar sus datos", async () => {
    mocks.auth.mockResolvedValue({ context: null, response: new Response("Sin permiso", { status: 403 }) });
    expect((await GET(new Request("https://katia.local/inventario/export?type=stock"))).status).toBe(403);
    expect(mocks.data).not.toHaveBeenCalled();
  });

  test("un fallo de consulta no descarga un Excel incompleto", async () => {
    mocks.data.mockRejectedValue(new Error("Base no disponible"));
    const response = await GET(new Request("https://katia.local/inventario/export?type=kardex"));
    expect(response.status).toBe(503);
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  test("stock distingue valores desconocidos y no suma cajas con unidades", async () => {
    const fixture = await mocks.data();
    fixture.productos = [
      { ...producto("p1", "Tabla"), costo_unitario_promedio: 20, valor_stock: 100 },
      { ...producto("p2", "Caja"), unidad: "caja" },
    ];
    mocks.data.mockResolvedValue(fixture);
    const { workbook } = await descargar("/inventario/export?type=stock");
    const sheet = workbook.getWorksheet("Stock Actual")!;
    expect(sheet.getCell("A2").value).toContain("Valor registrado: S/ 100.00 (parcial");
    expect(sheet.getCell("H6").value).toBe("Sin costo en compras");
    expect(sheet.getCell("I6").value).toBe("Sin costo en compras");
    expect(sheet.getCell("F7").value).toBe("Unidades distintas");
    expect(sheet.getCell("J7").value).toBe("Unidades distintas");
    const category = workbook.getWorksheet("Prueba")!;
    expect(category.getCell("E5").value).toBe("Sin costo en compras");
    expect(category.getCell("F5").value).toBe("Sin costo en compras");
  });

  test("conserva las sumas cuando las unidades coinciden y no inventa valor sin compras", async () => {
    const { workbook } = await descargar("/inventario/export?type=stock");
    const sheet = workbook.getWorksheet("Stock Actual")!;
    expect(sheet.getCell("A2").value).toContain("Sin costo en compras");
    expect(sheet.getCell("F7").value).toMatchObject({ formula: "SUM(F5:F6)" });
    expect(sheet.getCell("I7").value).toBe("Sin costo en compras");
  });

  test("stock vacío genera totales cero sin fórmulas circulares", async () => {
    const fixture = await mocks.data();
    fixture.productos = [];
    mocks.data.mockResolvedValue(fixture);
    const { workbook } = await descargar("/inventario/export?type=stock");
    const sheet = workbook.getWorksheet("Stock Actual")!;
    for (const cell of ["F5", "I5", "J5"]) expect(sheet.getCell(cell).value).toBe(0);
  });

  test("las categorías personalizadas no rompen ni mezclan las hojas del Excel", async () => {
    const categories = ["Herramientas/Obra", "Herramientas:Obra", "Stock Actual", "Kardex", "History", "'Prueba'",
      "Una categoría muy larga con el mismo inicio A", "Una categoría muy larga con el mismo inicio B"];
    const fixture = await mocks.data();
    fixture.productos = categories.map((categoria, i) => ({ ...producto(`p${i}`, `Producto ${i}`), categoria }));
    mocks.data.mockResolvedValue(fixture);
    const { workbook } = await descargar("/inventario/export?type=full");
    expect(workbook.worksheets).toHaveLength(categories.length + 2);
    expect(new Set(workbook.worksheets.map(s => s.name.toLowerCase())).size).toBe(categories.length + 2);
    for (let i = 0; i < categories.length; i++) {
      const sheet = workbook.worksheets[i + 1];
      expect(sheet.getCell("A1").value).toContain(categories[i]);
      expect(sheet.getCell("B4").value).toBe(`Producto ${i}`);
      expect(sheet.name.length).toBeLessThanOrEqual(31);
    }
    expect(workbook.getWorksheet("Kardex")!.getCell("A3").value).toBe("Fecha");
  });
});
