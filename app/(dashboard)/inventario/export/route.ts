import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAuthContext } from "@/lib/auth";
import { getInventarioRobustoData } from "@/lib/data";
import { getEmpresaConfig } from "@/lib/company-config";

const KATIA_VIOLET = "FF8B5CF6";
const KATIA_VIOLET_LIGHT = "FFE9D5FF";
const HEADER_BG = "FF1C1C2A";
const HEADER_FG = "FFF4F4F5";
const ODD_ROW = "FF14141F";
const EVEN_ROW = "FF1C1C2A";
const DANGER_BG = "FFFFE4E4";
const DANGER_FG = "FFDC2626";

function applyHeaderStyle(cell: ExcelJS.Cell, light = false) {
  cell.font = { bold: true, color: { argb: light ? "FF18181B" : HEADER_FG }, size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: light ? KATIA_VIOLET_LIGHT : HEADER_BG } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    bottom: { style: "medium", color: { argb: KATIA_VIOLET } },
  };
}

export async function GET(request: Request) {
  await requireAuthContext({ redirectTo: null });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "stock";

  const [data, empresa] = await Promise.all([
    getInventarioRobustoData(),
    getEmpresaConfig().catch(() => null),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = empresa?.nombre ?? "Katia Suite";
  workbook.created = new Date();
  workbook.modified = new Date();

  const fechaStr = new Date().toLocaleDateString("es-PE", {
    day: "2-digit", month: "long", year: "numeric",
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
    const valorTotal = data.productos.reduce((a, p) => a + p.valor_stock, 0);
    subCell.value = `${data.productos.length} productos · Valorización total: S/ ${valorTotal.toFixed(2)} · Generado por Katia Suite v1.0`;
    subCell.font = { italic: true, size: 9, color: { argb: "FF71717A" } };
    subCell.alignment = { horizontal: "center" };
    sheet.getRow(2).height = 16;

    // Fila vacía
    sheet.addRow([]);

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
        p.costo_unitario_promedio,
        p.valor_stock,
        p.vendido,
        stockBajo ? "⚠ Stock bajo" : "OK",
      ]);
      row.height = 18;

      const bgColor = dataRowNum % 2 === 0 ? EVEN_ROW : ODD_ROW;

      row.eachCell((cell, colNum) => {
        cell.font = { size: 10, color: { argb: HEADER_FG } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: stockBajo ? DANGER_BG : bgColor } };
        cell.alignment = { vertical: "middle" };

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
    const totalRow = sheet.addRow([
      "", "TOTAL", "", "", "",
      { formula: `SUM(F5:F${lastDataRow})` },
      "",
      "",
      { formula: `SUM(I5:I${lastDataRow})` },
      { formula: `SUM(J5:J${lastDataRow})` },
      "",
    ]);
    totalRow.height = 22;
    totalRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: HEADER_FG } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D1B69" } };
      cell.border = { top: { style: "medium", color: { argb: KATIA_VIOLET } } };
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

    for (const [cat, productos] of byCategoria) {
      const sheetCat = workbook.addWorksheet(cat.slice(0, 30));
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
          p.costo_unitario_promedio, p.valor_stock, p.vendido,
          p.activo ? "Sí" : "No", low ? "⚠ Bajo" : "OK",
        ]);
        r.height = 17;
        r.eachCell((cell, colNum) => {
          cell.font = { size: 10, color: { argb: HEADER_FG } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: low ? DANGER_BG : catRow % 2 === 0 ? EVEN_ROW : ODD_ROW } };
          if (low) cell.font = { size: 10, color: { argb: DANGER_FG } };
          if ([3, 4, 7].includes(colNum)) cell.numFmt = "#,##0.00";
          if ([5, 6].includes(colNum)) cell.numFmt = '"S/"#,##0.00';
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
    sheet.addRow([]);

    const kHeaders = sheet.addRow(["Fecha", "Código", "Producto", "Categoría", "Tipo", "Cantidad", "Impacto", "Costo unit.", "Referencia"]);
    kHeaders.height = 22;
    kHeaders.eachCell((cell) => applyHeaderStyle(cell));
    [14, 18, 36, 18, 18, 14, 12, 14, 22].forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    let rowIdx = 4;
    for (const row of data.kardex) {
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
  const today = new Date().toISOString().slice(0, 10);
  const filename = `katia-inventario-${type}-${today}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
