import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAuthContext } from "@/lib/auth";
import {
  getClientesRows,
  getChoferesRows,
  getProveedoresRows,
  getInventarioRobustoData,
  getVentasRows,
  getVentasMuebleTerminadoRows,
  getPersonalRows,
} from "@/lib/data";
import { getEmpresaConfig } from "@/lib/company-config";

// ── Palette ──────────────────────────────────────────────────────
const BG_HEADER = "FF1C1C2A";
const FG_HEADER = "FFF4F4F5";
const VIOLET    = "FF8B5CF6";
const GREEN     = "FF059669";
const ODD       = "FF14141F";
const EVEN      = "FF1C1C2A";
const WARN_BG   = "FFFFF3CC";
const WARN_FG   = "FFB45309";

type HAlign = "left" | "center" | "right";

function header(cell: ExcelJS.Cell, fgColor = FG_HEADER, bgColor = BG_HEADER, align: HAlign = "center") {
  cell.font  = { bold: true, color: { argb: fgColor }, size: 10 };
  cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
  cell.alignment = { horizontal: align, vertical: "middle", wrapText: true };
  cell.border = { bottom: { style: "medium", color: { argb: VIOLET } } };
}

function data(cell: ExcelJS.Cell, rowIdx: number) {
  cell.font = { size: 10, color: { argb: FG_HEADER } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIdx % 2 === 0 ? EVEN : ODD } };
  cell.alignment = { vertical: "middle" };
}

function title(ws: ExcelJS.Worksheet, text: string, cols: number, date: string) {
  ws.mergeCells(1, 1, 1, cols);
  const c = ws.getCell(1, 1);
  c.value = text;
  c.font  = { bold: true, size: 13, color: { argb: FG_HEADER } };
  c.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: BG_HEADER } };
  c.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, cols);
  const sub = ws.getCell(2, 1);
  sub.value = `Generado por Katia Suite · ${date}`;
  sub.font  = { italic: true, size: 9, color: { argb: "FF71717A" } };
  sub.alignment = { horizontal: "center" };
  ws.getRow(2).height = 16;
  ws.addRow([]);
}

function addTotalsRow(ws: ExcelJS.Worksheet, numCols: number) {
  const row = ws.addRow(Array(numCols).fill(""));
  row.height = 4;
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D1B69" } };
    c.border = { top: { style: "medium", color: { argb: VIOLET } } };
  });
}

export async function GET(request: Request) {
  await requireAuthContext({ redirectTo: null });

  const [data_, empresa, choferes, proveedores, ventasMadera, ventasMuebles, personal] = await Promise.all([
    getInventarioRobustoData(),
    getEmpresaConfig().catch(() => null),
    getChoferesRows(),
    getProveedoresRows(),
    getVentasRows(),
    getVentasMuebleTerminadoRows(),
    getPersonalRows(),
  ]);

  const clientes = await getClientesRows();

  const wb   = new ExcelJS.Workbook();
  wb.creator = empresa?.nombre ?? "Katia Suite";
  wb.created = new Date();

  const fechaStr = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

  // ─────────────────────────────────────────────────────────────────
  // HOJA 1 · ÍNDICE
  // ─────────────────────────────────────────────────────────────────
  const wsIdx = wb.addWorksheet("📋 Índice", {
    properties: { tabColor: { argb: VIOLET } },
  });
  wsIdx.mergeCells("A1:D1");
  const idxT = wsIdx.getCell("A1");
  idxT.value = `${empresa?.nombre ?? "Katia Suite"} — Respaldo de datos al ${fechaStr}`;
  idxT.font  = { bold: true, size: 14, color: { argb: FG_HEADER } };
  idxT.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: BG_HEADER } };
  idxT.alignment = { horizontal: "center", vertical: "middle" };
  wsIdx.getRow(1).height = 32;
  wsIdx.addRow([]);

  const sheets = [
    ["👥 Compradores",  "Clientes / compradores registrados en el sistema"],
    ["🚛 Choferes",     "Transportistas que realizan entregas"],
    ["🏭 Proveedores",  "Empresas y personas que suministran insumos"],
    ["📦 Inventario",   "Stock actual de productos con valorización"],
    ["💰 Ventas madera","Ventas de madera cortada del período"],
    ["🛋️ Ventas muebles","Ventas de muebles terminados del período"],
    ["👷 Personal",     "Colaboradores y sus adelantos"],
  ];

  const hRow = wsIdx.addRow(["Hoja", "Descripción", "Registros", "Nota"]);
  hRow.height = 20;
  hRow.eachCell((c) => header(c));
  [28, 48, 16, 32].forEach((w, i) => { wsIdx.getColumn(i + 1).width = w; });

  const counts = [
    clientes.length, choferes.length, proveedores.length,
    data_.productos.length, ventasMadera.length, ventasMuebles.length,
    personal.empleados.length,
  ];

  sheets.forEach(([name, desc], i) => {
    const r = wsIdx.addRow([name, desc, counts[i], ""]);
    r.height = 17;
    r.eachCell((c, col) => {
      c.font = { size: 10, color: { argb: FG_HEADER } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? ODD : EVEN } };
      if (col === 3) c.alignment = { horizontal: "right" };
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // HOJA 2 · COMPRADORES
  // ─────────────────────────────────────────────────────────────────
  const wsC = wb.addWorksheet("👥 Compradores", { properties: { tabColor: { argb: GREEN } } });
  title(wsC, `Compradores — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, 8, fechaStr);
  const hC = wsC.addRow(["Nombre", "Tipo", "Documento", "Teléfono", "Estado", "RUC", "Dirección", "Registrado"]);
  hC.height = 20; hC.eachCell((c) => header(c));
  [32, 16, 16, 16, 14, 18, 36, 14].forEach((w, i) => { wsC.getColumn(i + 1).width = w; });
  clientes.forEach((c, i) => {
    const r = wsC.addRow([
      c.nombre,
      c.tipo_persona === "empresa" ? "Empresa" : c.tipo_persona === "natural" ? "Persona natural" : "—",
      c.documento ?? "—",
      c.telefono ?? "—",
      c.estado,
      (c as { ruc?: string }).ruc ?? "—",
      (c as { direccion?: string }).direccion ?? "—",
      new Date(c.created_at).toLocaleDateString("es-PE"),
    ]);
    r.height = 17; r.eachCell((cell) => data(cell, i));
  });
  addTotalsRow(wsC, 8);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 3 · CHOFERES
  // ─────────────────────────────────────────────────────────────────
  const wsCh = wb.addWorksheet("🚛 Choferes", { properties: { tabColor: { argb: "FF06B6D4" } } });
  title(wsCh, `Choferes — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, 5, fechaStr);
  const hCh = wsCh.addRow(["Nombre", "Teléfono", "Placa", "Activo", "Registrado"]);
  hCh.height = 20; hCh.eachCell((c) => header(c));
  [30, 18, 16, 12, 14].forEach((w, i) => { wsCh.getColumn(i + 1).width = w; });
  choferes.forEach((c, i) => {
    const r = wsCh.addRow([c.nombre, c.telefono ?? "—", c.placa ?? "—", c.activo ? "Sí" : "No", new Date(c.created_at).toLocaleDateString("es-PE")]);
    r.height = 17; r.eachCell((cell) => data(cell, i));
  });
  addTotalsRow(wsCh, 5);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 4 · PROVEEDORES
  // ─────────────────────────────────────────────────────────────────
  const wsPr = wb.addWorksheet("🏭 Proveedores", { properties: { tabColor: { argb: "FFF59E0B" } } });
  title(wsPr, `Proveedores — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, 4, fechaStr);
  const hPr = wsPr.addRow(["Nombre", "Documento", "Teléfono", "Registrado"]);
  hPr.height = 20; hPr.eachCell((c) => header(c));
  [34, 18, 18, 14].forEach((w, i) => { wsPr.getColumn(i + 1).width = w; });
  proveedores.forEach((p, i) => {
    const r = wsPr.addRow([p.nombre, p.documento ?? "—", p.telefono ?? "—", new Date(p.created_at).toLocaleDateString("es-PE")]);
    r.height = 17; r.eachCell((cell) => data(cell, i));
  });
  addTotalsRow(wsPr, 4);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 5 · INVENTARIO (resumen)
  // ─────────────────────────────────────────────────────────────────
  const wsInv = wb.addWorksheet("📦 Inventario", { properties: { tabColor: { argb: "FF3B82F6" } } });
  const invCols = 11;
  title(wsInv, `Inventario — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, invCols, fechaStr);
  const hInv = wsInv.addRow(["Código", "Nombre", "Categoría", "Unidad", "Stock actual", "Stock mín.", "Costo unit.", "Valor stock", "Vendido", "Activo", "Estado"]);
  hInv.height = 22; hInv.eachCell((c) => header(c));
  [18, 34, 18, 12, 14, 12, 16, 16, 12, 10, 14].forEach((w, i) => { wsInv.getColumn(i + 1).width = w; });

  data_.productos.forEach((p, idx) => {
    const bajo = Number(p.stock_actual) <= Number(p.stock_minimo);
    const r = wsInv.addRow([
      p.codigo, p.nombre, p.categoria, p.unidad,
      p.stock_actual, p.stock_minimo,
      p.costo_unitario_promedio, p.valor_stock, p.vendido,
      p.activo ? "Sí" : "No", bajo ? "⚠ Stock bajo" : "OK",
    ]);
    r.height = 17;
    r.eachCell((cell, col) => {
      cell.font  = { size: 10, color: { argb: bajo ? WARN_FG : FG_HEADER } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: bajo ? WARN_BG : idx % 2 === 0 ? ODD : EVEN } };
      cell.alignment = { vertical: "middle" };
      if ([5, 6, 9].includes(col)) cell.numFmt = "#,##0.00";
      if ([7, 8].includes(col))    cell.numFmt = '"S/"#,##0.00';
    });
  });
  addTotalsRow(wsInv, invCols);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 6 · VENTAS MADERA
  // ─────────────────────────────────────────────────────────────────
  const wsVM = wb.addWorksheet("💰 Ventas madera", { properties: { tabColor: { argb: "FFF97316" } } });
  title(wsVM, `Ventas de madera — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, 7, fechaStr);
  const hVM = wsVM.addRow(["Correlativo", "Fecha", "Estado", "Tipo entrega", "Modalidad pago", "Total", "Creado"]);
  hVM.height = 20; hVM.eachCell((c) => header(c));
  [16, 14, 14, 18, 18, 16, 14].forEach((w, i) => { wsVM.getColumn(i + 1).width = w; });
  ventasMadera.forEach((v, i) => {
    const r = wsVM.addRow([
      v.correlativo ?? v.id.slice(0, 8),
      v.fecha, v.estado, v.tipo_entrega, v.modalidad_pago,
      Number(v.total),
      new Date(v.created_at).toLocaleDateString("es-PE"),
    ]);
    r.height = 17;
    r.eachCell((cell, col) => {
      data(cell, i);
      if (col === 6) cell.numFmt = '"S/"#,##0.00';
    });
  });
  addTotalsRow(wsVM, 7);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 7 · VENTAS MUEBLES
  // ─────────────────────────────────────────────────────────────────
  const wsVMu = wb.addWorksheet("🛋️ Ventas muebles", { properties: { tabColor: { argb: "FFEC4899" } } });
  title(wsVMu, `Ventas de muebles — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, 7, fechaStr);
  const hVMu = wsVMu.addRow(["Correlativo", "Fecha", "Estado", "Tipo entrega", "Modalidad pago", "Total", "Creado"]);
  hVMu.height = 20; hVMu.eachCell((c) => header(c));
  [16, 14, 14, 18, 18, 16, 14].forEach((w, i) => { wsVMu.getColumn(i + 1).width = w; });
  ventasMuebles.forEach((v, i) => {
    const r = wsVMu.addRow([
      v.correlativo ?? v.id.slice(0, 8),
      v.fecha, v.estado, v.tipo_entrega, v.modalidad_pago,
      Number(v.total),
      new Date(v.created_at).toLocaleDateString("es-PE"),
    ]);
    r.height = 17;
    r.eachCell((cell, col) => {
      data(cell, i);
      if (col === 6) cell.numFmt = '"S/"#,##0.00';
    });
  });
  addTotalsRow(wsVMu, 7);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 8 · PERSONAL
  // ─────────────────────────────────────────────────────────────────
  const wsPers = wb.addWorksheet("👷 Personal", { properties: { tabColor: { argb: "FF7C3AED" } } });
  title(wsPers, `Personal — ${empresa?.nombre ?? "Katia Suite"} · ${fechaStr}`, 6, fechaStr);
  const hPers = wsPers.addRow(["Nombre", "DNI", "Cargo", "Teléfono", "Activo", "Ingreso"]);
  hPers.height = 20; hPers.eachCell((c) => header(c));
  [30, 16, 22, 16, 10, 14].forEach((w, i) => { wsPers.getColumn(i + 1).width = w; });
  personal.empleados.forEach((e, i) => {
    const r = wsPers.addRow([
      e.nombre, e.dni ?? "—", e.cargo ?? "—", e.telefono ?? "—",
      e.activo ? "Sí" : "No",
      e.fecha_ingreso ? new Date(e.fecha_ingreso).toLocaleDateString("es-PE") : "—",
    ]);
    r.height = 17; r.eachCell((cell) => data(cell, i));
  });
  addTotalsRow(wsPers, 6);

  // ─────────────────────────────────────────────────────────────────
  // Respuesta
  // ─────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const today  = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="katia-respaldo-completo-${today}.xlsx"`,
    },
  });
}
