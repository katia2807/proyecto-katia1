import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireApiAuth } from "@/lib/api-auth";
import { getInventarioRobustoData } from "@/lib/data";
import { getEmpresaConfig } from "@/lib/company-config";
import { getInventarioFiltros } from "@/lib/inventario-filtros";
import { filtrarInventarioKardex, getInventarioHistorialAviso } from "@/lib/inventario-historial";
import { fechaHoyPeru } from "@/lib/utils";

const KATIA_VIOLET = "FF8B5CF6";
const KATIA_VIOLET_LIGHT = "FFE9D5FF";
const HEADER_BG = "FF1C1C2A";
const HEADER_FG = "FFF4F4F5";
const ODD_ROW = "FF14141F";
const EVEN_ROW = "FF1C1C2A";
const DANGER_BG = "FFFFE4E4";
const DANGER_FG = "FFDC2626";

// El nombre guardado se conserva en los datos y el título; solo la pestaña
// necesita un nombre compatible y único dentro del libro de Excel.
function nombreHojaCategoria(categoria: string, usados: Set<string>): string {
  const base = categoria.replace(/[*?:/\\[\]]/g, " ").trim()
    .replace(/^'+|'+$/g, "").slice(0, 31).replace(/'+$/g, "") || "Categoría";
  let nombre = base;
  let indice = 2;
  while (usados.has(nombre.toLowerCase())) {
    const sufijo = ` (${indice++})`;
    nombre = `${base.slice(0, 31 - sufijo.length).replace(/'+$/g, "")}${sufijo}`;
  }
  usados.add(nombre.toLowerCase());
  return nombre;
}

function applyHeaderStyle(cell: ExcelJS.Cell, light = false) {
  cell.font = { bold: true, color: { argb: light ? "FF18181B" : HEADER_FG }, size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: light ? KATIA_VIOLET_LIGHT : HEADER_BG } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    bottom: { style: "medium", color: { argb: KATIA_VIOLET } },
  };
}

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner_admin", "gerencia", "almacen", "ventas"]);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "stock";

  let data: Awaited<ReturnType<typeof getInventarioRobustoData>>;
  let empresa: Awaited<ReturnType<typeof getEmpresaConfig>> | null;
  try {
    [data, empresa] = await Promise.all([
      getInventarioRobustoData({ organizationId: auth.context.organizationId, complete: true }),
      getEmpresaConfig(auth.context.organizationId).catch(() => null),
    ]);
  } catch {
    return NextResponse.json({ error: "No se pudo consultar todo el inventario. Intenta descargarlo nuevamente." }, { status: 503 });
  }
  const filtros = getInventarioFiltros(url.searchParams);
  const productoId = data.productos.some(p => p.id === filtros.kardexProducto) ? filtros.kardexProducto : "todos";
  const tipoKardex = type === "kardex" ? filtros.kardexTipo : "todos";
  const productoKardex = type === "kardex" ? productoId : "todos";
  const kardexRows = filtrarInventarioKardex(data.kardex, tipoKardex, productoKardex);
  const historialAviso = getInventarioHistorialAviso(data.historialMovimientos.cargados, data.historialMovimientos.total);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = empresa?.nombre ?? "Katia Suite";
  workbook.created = new Date();
  workbook.modified = new Date();

  const fechaStr = new Date().toLocaleDateString("es-PE", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "America/Lima",
  });

  if (type === "stock" || type === "full") {
    const sheet = workbook.addWorksheet("Stock Actual", {
      properties: { tabColor: { argb: KATIA_VIOLET } },
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    // Título superior
    sheet.mergeCells("A1:K1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `${empresa?.nombre ?? "Katia Suite"} — Inventario al ${fechaStr}`;
    titleCell.font = { bold: true, size: 13, color: { argb: HEADER_FG } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    // Subtítulo métricas
    sheet.mergeCells("A2:K2");
    const subCell = sheet.getCell("A2");
    const productosSinCosto = data.productos.filter(p => Number(p.stock_actual) !== 0 && Number(p.costo_unitario_promedio) <= 0).length;
    const productosConValor = data.productos.filter(p => Number(p.stock_actual) !== 0 && Number(p.costo_unitario_promedio) > 0);
    const sinValorConocido = productosSinCosto > 0 && productosConValor.length === 0;
    const valorTotal = productosConValor.reduce((a, p) => a + p.valor_stock, 0);
    const valorLabel = sinValorConocido ? "Sin costo en compras" : `S/ ${valorTotal.toFixed(2)}`;
    const valorAlcance = productosSinCosto > 0 ? ` (${sinValorConocido ? "" : "parcial: "}${productosSinCosto} ${productosSinCosto === 1 ? "producto" : "productos"} con stock sin costo en compras)` : "";
    subCell.value = `${data.productos.length} productos · Valor registrado: ${valorLabel}${valorAlcance}`;
    subCell.font = { italic: true, size: 9, color: { argb: "FF71717A" } };
    subCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.getRow(2).height = productosSinCosto > 0 ? 30 : 16;

    // Fila vacía
    const noticeRow = sheet.addRow([historialAviso ?? ""]);
    if (historialAviso) {
      sheet.mergeCells("A3:K3");
      noticeRow.height = 30;
      noticeRow.getCell(1).font = { size: 9, color: { argb: DANGER_FG } };
      noticeRow.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    }

    // Headers
    const headers = [
      { header: "Código", width: 18 },
      { header: "Nombre", width: 36 },
      { header: "Categoría", width: 18 },
      { header: "Unidad", width: 12 },
      { header: "Activo", width: 10 },
      { header: "Stock actual", width: 14 },
      { header: "Stock mínimo", width: 14 },
      { header: "Costo unit. prom.", width: 18 },
      { header: "Valor stock (S/)", width: 18 },
      { header: "Vendido", width: 12 },
      { header: "Estado stock", width: 14 },
    ];
    const headerRow = sheet.addRow(headers.map((h) => h.header));
    headerRow.height = 22;
    headerRow.eachCell((cell) => applyHeaderStyle(cell));

    // Configurar anchos
    headers.forEach((h, i) => {
      sheet.getColumn(i + 1).width = h.width;
    });

    // Datos con formato
    let dataRowNum = 5;
    for (const p of data.productos) {
      const stockBajo = p.stock_actual <= p.stock_minimo;
      const row = sheet.addRow([
        p.codigo,
        p.nombre,
        p.categoria,
        p.unidad,
        p.activo ? "Sí" : "No",
        p.stock_actual,
        p.stock_minimo,
        Number(p.costo_unitario_promedio) > 0 ? p.costo_unitario_promedio : "Sin costo en compras",
        Number(p.stock_actual) !== 0 && Number(p.costo_unitario_promedio) <= 0 ? "Sin costo en compras" : p.valor_stock,
        p.vendido,
        stockBajo ? "⚠ Stock bajo" : "OK",
      ]);
      row.height = Number(p.stock_actual) !== 0 && Number(p.costo_unitario_promedio) <= 0 ? 30 : 18;

      const bgColor = dataRowNum % 2 === 0 ? EVEN_ROW : ODD_ROW;

      row.eachCell((cell, colNum) => {
        cell.font = { size: 10, color: { argb: HEADER_FG } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: stockBajo ? DANGER_BG : bgColor } };
        cell.alignment = { vertical: "middle", wrapText: [8, 9].includes(colNum) };

        // Formato numérico
        if ([6, 7, 10].includes(colNum)) {
          cell.numFmt = "#,##0.00";
        }
        if ([8, 9].includes(colNum)) {
          cell.numFmt = '"S/"#,##0.00';
        }
      });

      // Color especial para stock bajo
      if (stockBajo) {
        row.getCell(11).font = { bold: true, size: 10, color: { argb: DANGER_FG } };
        row.getCell(6).font = { bold: true, size: 10, color: { argb: DANGER_FG } };
      }

      dataRowNum++;
    }

    // Fila de totales
    const lastDataRow = sheet.lastRow!.number;
    const unidades = new Set(data.productos.map(p => p.unidad.trim().toLowerCase()));
    const sumCantidad = (col: string) => data.productos.length === 0 ? 0 :
      unidades.size > 1 ? "Unidades distintas" : { formula: `SUM(${col}5:${col}${lastDataRow})` };
    const totalRow = sheet.addRow([
      "", "TOTAL", "", "", "",
      sumCantidad("F"),
      "",
      "",
      data.productos.length === 0 ? 0 : sinValorConocido ? "Sin costo en compras" : { formula: `SUM(I5:I${lastDataRow})` },
      sumCantidad("J"),
      "",
    ]);
    totalRow.height = unidades.size > 1 || sinValorConocido ? 30 : 22;
    totalRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: HEADER_FG } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D1B69" } };
      cell.border = { top: { style: "medium", color: { argb: KATIA_VIOLET } } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    totalRow.getCell(6).numFmt = "#,##0.00";
    totalRow.getCell(9).numFmt = '"S/"#,##0.00';
    totalRow.getCell(10).numFmt = "#,##0.00";

    // Por categoría — una hoja por cada categoría con productos
    const byCategoria = new Map<string, typeof data.productos>();
    for (const p of data.productos) {
      const cat = p.categoria ?? "Sin categoría";
      if (!byCategoria.has(cat)) byCategoria.set(cat, []);
      byCategoria.get(cat)!.push(p);
    }

    const nombresUsados = new Set(["stock actual", "kardex", "history"]);
    for (const [cat, productos] of byCategoria) {
      const sheetCat = workbook.addWorksheet(nombreHojaCategoria(cat, nombresUsados));
      sheetCat.mergeCells("A1:I1");
      const catTitle = sheetCat.getCell("A1");
      catTitle.value = `${cat} — ${fechaStr}`;
      catTitle.font = { bold: true, size: 12, color: { argb: HEADER_FG } };
      catTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      catTitle.alignment = { horizontal: "center" };
      sheetCat.getRow(1).height = 24;
      sheetCat.addRow([]);

      const catHeaders = sheetCat.addRow(["Código", "Nombre", "Stock actual", "Stock mínimo", "Costo unit.", "Valor stock", "Vendido", "Activo", "Estado"]);
      catHeaders.height = 20;
      catHeaders.eachCell((cell) => applyHeaderStyle(cell, true));
      [20, 36, 14, 14, 16, 16, 12, 10, 14].forEach((w, i) => { sheetCat.getColumn(i + 1).width = w; });

      let catRow = 4;
      for (const p of productos) {
        const low = p.stock_actual <= p.stock_minimo;
        const r = sheetCat.addRow([
          p.codigo, p.nombre, p.stock_actual, p.stock_minimo,
          Number(p.costo_unitario_promedio) > 0 ? p.costo_unitario_promedio : "Sin costo en compras",
          Number(p.stock_actual) !== 0 && Number(p.costo_unitario_promedio) <= 0 ? "Sin costo en compras" : p.valor_stock, p.vendido,
          p.activo ? "Sí" : "No", low ? "⚠ Bajo" : "OK",
        ]);
        r.height = Number(p.stock_actual) !== 0 && Number(p.costo_unitario_promedio) <= 0 ? 30 : 17;
        r.eachCell((cell, colNum) => {
          cell.font = { size: 10, color: { argb: HEADER_FG } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: low ? DANGER_BG : catRow % 2 === 0 ? EVEN_ROW : ODD_ROW } };
          if (low) cell.font = { size: 10, color: { argb: DANGER_FG } };
          if ([3, 4, 7].includes(colNum)) cell.numFmt = "#,##0.00";
          if ([5, 6].includes(colNum)) cell.numFmt = '"S/"#,##0.00';
          cell.alignment = { vertical: "middle", wrapText: [5, 6].includes(colNum) };
        });
        catRow++;
      }
    }
  }

  // Kardex tab
  if (type === "kardex" || type === "full") {
    const sheet = workbook.addWorksheet("Kardex", {
      properties: { tabColor: { argb: "FF06B6D4" } },
    });

    sheet.mergeCells("A1:I1");
    const t = sheet.getCell("A1");
    t.value = `${empresa?.nombre ?? "Katia Suite"} — Kardex al ${fechaStr}`;
    t.font = { bold: true, size: 13, color: { argb: HEADER_FG } };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    t.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;
    const tipoLabel = { todos: "Todos", entrada_compra: "Entrada compra", salida_venta: "Salida venta", ajuste: "Ajuste" }[tipoKardex];
    const productoLabel = data.productos.find(p => p.id === productoKardex)?.nombre ?? "Todos";
    const scopeRow = sheet.addRow([`${kardexRows.length} ${kardexRows.length === 1 ? "movimiento" : "movimientos"} · Tipo: ${tipoLabel} · Producto: ${productoLabel}${historialAviso ? `\n${historialAviso}` : ""}`]);
    sheet.mergeCells("A2:I2");
    scopeRow.height = historialAviso ? 34 : 20;
    scopeRow.getCell(1).font = { size: 9, color: { argb: historialAviso ? DANGER_FG : "FF71717A" } };
    scopeRow.getCell(1).alignment = { wrapText: true, vertical: "middle" };

    const kHeaders = sheet.addRow(["Fecha", "Código", "Producto", "Categoría", "Tipo", "Cantidad", "Impacto", "Costo unit.", "Referencia"]);
    kHeaders.height = 22;
    kHeaders.eachCell((cell) => applyHeaderStyle(cell));
    [14, 18, 36, 18, 18, 14, 12, 14, 22].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    let rowIdx = 4;
    for (const row of kardexRows) {
      const r = sheet.addRow([
        row.fecha, row.producto_codigo, row.producto_nombre,
        row.categoria, row.tipo, row.cantidad, row.impacto,
        row.costo_unitario ?? "", row.referencia ?? "",
      ]);
      r.height = 17;
      r.eachCell((cell) => {
        cell.font = { size: 10, color: { argb: HEADER_FG } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIdx % 2 === 0 ? EVEN_ROW : ODD_ROW } };
      });
      r.getCell(6).numFmt = "#,##0.00";
      r.getCell(7).numFmt = "#,##0.00";
      r.getCell(8).numFmt = '"S/"#,##0.00';
      rowIdx++;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const today = fechaHoyPeru();
  const filename = `katia-inventario-${type}-${today}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
