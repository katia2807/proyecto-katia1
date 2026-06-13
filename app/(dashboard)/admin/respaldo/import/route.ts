import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/runtime";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text).trim();
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result).trim();
  return String(v).trim();
}

function normalizeText(v: string): string {
  const repaired = v
    .replace(/Ã³/g, "o")
    .replace(/Ã­/g, "i")
    .replace(/Ã¡/g, "a")
    .replace(/Ã©/g, "e")
    .replace(/Ãº/g, "u")
    .replace(/Ã±/g, "n")
    .replace(/â€”/g, "-");

  return repaired
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function num(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = str(v).replace(/[^\d,.-]/g, "");
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = s.length - comma - 1;
    s = decimals > 0 && decimals <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function codeFromName(nombre: string): string {
  const base = normalizeText(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "producto").slice(0, 36).toUpperCase();
}

function inferCategoria(nombre: string, fallback: string | null): string | null {
  if (fallback) return fallback;
  const q = normalizeText(nombre);
  if (/\b(mesa|silla|cama|camarote|ropero|closet|comoda|velador|estante|mueble|banca|escritorio)\b/.test(q)) {
    return "Muebles";
  }
  if (/\b(tabla|tablon|liston|cuarton|poste|viga|madera|tornillo|clavo|bisagra|riel|barniz|laca|cola|pegamento|melamina|triplay|mdf)\b/.test(q)) {
    return "Materiales e insumos";
  }
  if (/\b(servicio|corte|cepillado|aserrado|instalacion|flete|transporte)\b/.test(q)) {
    return "Servicios";
  }
  return "Sin clasificar";
}

function rowValues(row: ExcelJS.Row): ExcelJS.CellValue[] {
  const vals: ExcelJS.CellValue[] = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    vals[col - 1] = cell.value;
  });
  return vals;
}

function findWorksheet(wb: ExcelJS.Workbook, names: string[]): ExcelJS.Worksheet | undefined {
  const expected = new Set(names.map(normalizeText));
  return wb.worksheets.find((ws) => expected.has(normalizeText(ws.name)));
}

function findInventoryWorksheets(wb: ExcelJS.Workbook): ExcelJS.Worksheet[] {
  const preferred = findWorksheet(wb, ["📦 Inventario", "Inventario", "Stock Actual", "Stock"]);
  const ignored = new Set(["indice", "index", "kardex", "compradores", "clientes", "choferes", "proveedores"]);
  const sheets = preferred ? [preferred] : [];
  for (const ws of wb.worksheets) {
    const name = normalizeText(ws.name);
    if (sheets.includes(ws) || ignored.has(name)) continue;
    if (name.includes("inventario") || name.includes("stock") || name.includes("madera") || name.includes("producto")) {
      sheets.push(ws);
    }
  }
  return sheets;
}

function headerMap(vals: ExcelJS.CellValue[]): Map<string, number> {
  const headers = new Map<string, number>();
  vals.forEach((value, index) => {
    const key = normalizeText(str(value));
    if (key) headers.set(key, index);
  });
  return headers;
}

function findHeaderIndex(headers: Map<string, number>, candidates: string[]): number | null {
  const normalizedCandidates = candidates.map(normalizeText);
  for (const candidate of normalizedCandidates) {
    const exact = headers.get(candidate);
    if (exact !== undefined) return exact;
  }
  for (const [header, index] of headers) {
    if (
      normalizedCandidates.some((candidate) => header.includes(candidate) || candidate.includes(header)) ||
      (normalizedCandidates.includes("codigo") && header.includes("digo"))
    ) {
      return index;
    }
  }
  return null;
}

function previewWorksheet(ws: ExcelJS.Worksheet, maxRows = 8, maxCols = 12): string {
  const lines: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (lines.length >= maxRows) return;
    const vals = rowValues(row)
      .slice(0, maxCols)
      .map((value) => str(value).replace(/\s+/g, " ").slice(0, 40));
    if (vals.some(Boolean)) lines.push(`F${row.number}: ${vals.join(" | ")}`);
  });
  return lines.join(" / ");
}

function workbookDiagnostic(wb: ExcelJS.Workbook, sheets: ExcelJS.Worksheet[]): string {
  const sheetList = wb.worksheets
    .map((ws) => `${ws.name}(${ws.rowCount} filas x ${ws.columnCount} cols)`)
    .join(", ");
  const previews = sheets
    .map((ws) => `${ws.name}: ${previewWorksheet(ws) || "sin filas visibles"}`)
    .join(" || ");
  return `Hojas del archivo: ${sheetList}. Vista previa: ${previews}`;
}

// ── Sheet parsers ─────────────────────────────────────────────────────────────

type ImportResult = {
  sheet: string;
  inserted: number;
  skipped: number;
  errors: string[];
};

function parseCompradoresSheet(ws: ExcelJS.Worksheet): Array<{
  nombre: string;
  tipo_persona: string | null;
  documento: string | null;
  telefono: string | null;
  estado: string;
  ruc: string | null;
  direccion: string | null;
}> {
  const rows: ReturnType<typeof parseCompradoresSheet> = [];
  let dataStart = false;
  ws.eachRow((row) => {
    const vals = rowValues(row);
    const first = str(vals[0]).toLowerCase();
    // Detect header row
    if (!dataStart && (first === "nombre" || first.includes("nombre"))) {
      dataStart = true;
      return;
    }
    if (!dataStart) return;
    const nombre = str(vals[0]);
    if (!nombre || nombre.startsWith("Generado") || nombre.startsWith("—")) return;
    rows.push({
      nombre,
      tipo_persona: str(vals[1]) === "Empresa" ? "empresa" : str(vals[1]) === "Persona natural" ? "natural" : null,
      documento: str(vals[2]) !== "—" ? str(vals[2]) || null : null,
      telefono: str(vals[3]) !== "—" ? str(vals[3]) || null : null,
      estado: ["activo", "inactivo", "moroso"].includes(str(vals[4]).toLowerCase()) ? str(vals[4]).toLowerCase() : "activo",
      ruc: str(vals[5]) !== "—" ? str(vals[5]) || null : null,
      direccion: str(vals[6]) !== "—" ? str(vals[6]) || null : null,
    });
  });
  return rows;
}

function parseChoferesSheet(ws: ExcelJS.Worksheet): Array<{
  nombre: string;
  telefono: string | null;
  placa: string | null;
  activo: boolean;
}> {
  const rows: ReturnType<typeof parseChoferesSheet> = [];
  let dataStart = false;
  ws.eachRow((row) => {
    const vals = rowValues(row);
    const first = str(vals[0]).toLowerCase();
    if (!dataStart && (first === "nombre" || first.includes("nombre"))) {
      dataStart = true;
      return;
    }
    if (!dataStart) return;
    const nombre = str(vals[0]);
    if (!nombre || nombre.startsWith("Generado")) return;
    rows.push({
      nombre,
      telefono: str(vals[1]) !== "—" ? str(vals[1]) || null : null,
      placa: str(vals[2]) !== "—" ? str(vals[2]) || null : null,
      activo: str(vals[3]).toLowerCase() !== "no",
    });
  });
  return rows;
}

function parseProveedoresSheet(ws: ExcelJS.Worksheet): Array<{
  nombre: string;
  documento: string | null;
  telefono: string | null;
}> {
  const rows: ReturnType<typeof parseProveedoresSheet> = [];
  let dataStart = false;
  ws.eachRow((row) => {
    const vals = rowValues(row);
    const first = str(vals[0]).toLowerCase();
    if (!dataStart && (first === "nombre" || first.includes("nombre"))) {
      dataStart = true;
      return;
    }
    if (!dataStart) return;
    const nombre = str(vals[0]);
    if (!nombre || nombre.startsWith("Generado")) return;
    rows.push({
      nombre,
      documento: str(vals[1]) !== "—" ? str(vals[1]) || null : null,
      telefono: str(vals[2]) !== "—" ? str(vals[2]) || null : null,
    });
  });
  return rows;
}

function parseInventarioSheet(ws: ExcelJS.Worksheet): Array<{
  codigo: string;
  codigo_generado: boolean;
  nombre: string;
  categoria: string | null;
  unidad: string | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  costo_unitario: number | null;
  activo: boolean | null;
}> {
  const rows: ReturnType<typeof parseInventarioSheet> = [];
  type InventoryColumns = {
    codigo: number;
    nombre: number | null;
    categoria: number | null;
    unidad: number | null;
    activo: number | null;
    stockActual: number | null;
    stockMinimo: number | null;
    costoUnitario: number | null;
  };
  const defaultColumns: InventoryColumns = {
    codigo: 0,
    nombre: 1,
    categoria: 2,
    unidad: 3,
    stockActual: 4,
    stockMinimo: 5,
    costoUnitario: 6,
    activo: 9,
  };
  let columns: InventoryColumns | null = null;

  ws.eachRow((row) => {
    const vals = rowValues(row);
    if (!columns) {
      const headers = headerMap(vals);
      const codigo = findHeaderIndex(headers, ["codigo", "cod", "sku", "clave", "id producto"]);
      const nombre = findHeaderIndex(headers, [
        "nombre",
        "producto",
        "descripcion",
        "descripcion producto",
        "articulo",
        "item",
        "material",
        "insumo",
      ]);
      if (nombre !== null) {
        columns = {
          codigo: codigo ?? nombre,
          nombre,
          categoria: findHeaderIndex(headers, ["categoria", "familia", "linea", "tipo", "grupo", "rubro"]),
          unidad: findHeaderIndex(headers, ["unidad", "und", "um", "medida", "u m"]),
          activo: findHeaderIndex(headers, ["activo", "estado", "habilitado"]),
          stockActual: findHeaderIndex(headers, [
            "stock actual",
            "stock",
            "cantidad",
            "existencia",
            "existencias",
            "saldo",
            "inventario",
          ]),
          stockMinimo: findHeaderIndex(headers, ["stock minimo", "minimo", "stock min", "alerta", "punto reposicion"]),
          costoUnitario: findHeaderIndex(headers, [
            "costo unit prom",
            "costo unitario promedio",
            "costo unitario",
            "costo unit",
            "costo",
            "precio costo",
            "precio compra",
            "precio unitario",
            "precio",
          ]),
        };
        return;
      }

      const first = normalizeText(str(vals[0]));
      const second = normalizeText(str(vals[1]));
      if (row.number >= 4 && (first.includes("digo") || second.includes("nombre") || (first && second))) {
        columns = defaultColumns;
        if (first.includes("digo") || second.includes("nombre")) return;
      } else {
        return;
      }
    }

    const codigoOriginal = str(vals[columns.codigo]);
    const nombre = columns.nombre === null ? codigoOriginal : str(vals[columns.nombre]);
    const codigoKey = normalizeText(codigoOriginal);
    const nombreKey = normalizeText(nombre);
    if (
      (!codigoOriginal && !nombre) ||
      codigoKey.startsWith("generado") ||
      codigoKey === "total" ||
      codigoKey === "codigo" ||
      nombreKey === "nombre"
    ) return;
    const activoText = columns.activo === null ? "" : normalizeText(str(vals[columns.activo]));
    const categoria = columns.categoria !== null && str(vals[columns.categoria]) !== "—" ? str(vals[columns.categoria]) || null : null;
    rows.push({
      codigo: codigoOriginal || codeFromName(nombre),
      codigo_generado: !codigoOriginal,
      nombre: nombre || codigoOriginal,
      categoria: inferCategoria(nombre || codigoOriginal, categoria),
      unidad: columns.unidad !== null && str(vals[columns.unidad]) !== "—" ? str(vals[columns.unidad]) || null : null,
      stock_actual: columns.stockActual === null ? null : num(vals[columns.stockActual]),
      stock_minimo: columns.stockMinimo === null ? null : num(vals[columns.stockMinimo]),
      costo_unitario: columns.costoUnitario === null ? null : num(vals[columns.costoUnitario]),
      activo: columns.activo === null ? null : !["no", "false", "0", "inactivo"].includes(activoText),
    });
  });

  if (rows.length === 0) {
    ws.eachRow((row) => {
      const vals = rowValues(row);
      const first = str(vals[0]);
      const second = str(vals[1]);
      const secondIsNumber = num(vals[1]) !== null;
      const codigoOriginal = secondIsNumber ? "" : first;
      const nombre = secondIsNumber ? first : second;
      const codigoKey = normalizeText(codigoOriginal);
      const nombreKey = normalizeText(nombre);

      if (!codigoOriginal && !nombre) return;
      if (
        codigoKey === "codigo" ||
        codigoKey === "total" ||
        codigoKey.startsWith("generado") ||
        codigoKey.includes("inventario") ||
        nombreKey === "nombre" ||
        nombreKey.includes("katia suite")
      ) {
        return;
      }

      rows.push({
        codigo: codigoOriginal || codeFromName(nombre),
        codigo_generado: !codigoOriginal,
        nombre,
        categoria: inferCategoria(nombre, secondIsNumber ? null : str(vals[2]) || null),
        unidad: secondIsNumber ? null : str(vals[3]) !== "—" ? str(vals[3]) || null : null,
        stock_actual: secondIsNumber ? num(vals[1]) : num(vals[4]),
        stock_minimo: secondIsNumber ? null : num(vals[5]),
        costo_unitario: secondIsNumber ? num(vals[2]) : num(vals[6]),
        activo: !["no", "false", "0", "inactivo"].includes(normalizeText(str(vals[9]))),
      });
    });
  }

  return rows;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  await requireAuthContext({ redirectTo: null });

  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { ok: false, error: "La importación desde Excel solo está disponible en producción (Supabase)." },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo leer el archivo." }, { status: 400 });
  }

  const file = formData.get("archivo") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ ok: false, error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const ext = file.name.toLowerCase();
  if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
    return NextResponse.json({ ok: false, error: "Solo se aceptan archivos .xlsx o .xls." }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(arrayBuf as any);
  } catch {
    return NextResponse.json({ ok: false, error: "El archivo no es un Excel válido." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const results: ImportResult[] = [];

  // ── Compradores ───────────────────────────────────────────────────────────
  const wsC = wb.getWorksheet("👥 Compradores") ?? wb.getWorksheet("Compradores");
  if (wsC) {
    const parsed = parseCompradoresSheet(wsC);
    const result: ImportResult = { sheet: "Compradores", inserted: 0, skipped: 0, errors: [] };

    // Load existing names to skip duplicates
    const { data: existing } = await supabase
      .from("clientes")
      .select("nombre")
      .eq("organization_id", DEFAULT_ORG_ID);
    const existingNames = new Set((existing ?? []).map((r) => r.nombre.toLowerCase().trim()));

    for (const row of parsed) {
      if (existingNames.has(row.nombre.toLowerCase().trim())) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("clientes").insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: row.nombre,
        tipo_persona: row.tipo_persona,
        documento: row.documento,
        telefono: row.telefono,
        estado: row.estado,
        ruc: row.ruc,
        direccion: row.direccion,
      });
      if (error) {
        result.errors.push(`${row.nombre}: ${error.message}`);
      } else {
        result.inserted++;
        existingNames.add(row.nombre.toLowerCase().trim());
      }
    }
    results.push(result);
  }

  // ── Choferes ──────────────────────────────────────────────────────────────
  const wsCh = wb.getWorksheet("🚛 Choferes") ?? wb.getWorksheet("Choferes");
  if (wsCh) {
    const parsed = parseChoferesSheet(wsCh);
    const result: ImportResult = { sheet: "Choferes", inserted: 0, skipped: 0, errors: [] };

    const { data: existing } = await supabase
      .from("choferes")
      .select("nombre")
      .eq("organization_id", DEFAULT_ORG_ID);
    const existingNames = new Set((existing ?? []).map((r) => r.nombre.toLowerCase().trim()));

    for (const row of parsed) {
      if (existingNames.has(row.nombre.toLowerCase().trim())) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("choferes").insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: row.nombre,
        telefono: row.telefono,
        placa: row.placa,
        activo: row.activo,
      });
      if (error) {
        result.errors.push(`${row.nombre}: ${error.message}`);
      } else {
        result.inserted++;
        existingNames.add(row.nombre.toLowerCase().trim());
      }
    }
    results.push(result);
  }

  // ── Proveedores ───────────────────────────────────────────────────────────
  const wsPr = wb.getWorksheet("🏭 Proveedores") ?? wb.getWorksheet("Proveedores");
  if (wsPr) {
    const parsed = parseProveedoresSheet(wsPr);
    const result: ImportResult = { sheet: "Proveedores", inserted: 0, skipped: 0, errors: [] };

    const { data: existing } = await supabase
      .from("proveedores")
      .select("nombre")
      .eq("organization_id", DEFAULT_ORG_ID);
    const existingNames = new Set((existing ?? []).map((r) => r.nombre.toLowerCase().trim()));

    for (const row of parsed) {
      if (existingNames.has(row.nombre.toLowerCase().trim())) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("proveedores").insert({
        organization_id: DEFAULT_ORG_ID,
        nombre: row.nombre,
        documento: row.documento,
        telefono: row.telefono,
      });
      if (error) {
        result.errors.push(`${row.nombre}: ${error.message}`);
      } else {
        result.inserted++;
        existingNames.add(row.nombre.toLowerCase().trim());
      }
    }
    results.push(result);
  }

  // ── Inventario ───────────────────────────────────────────────────────────
  const inventorySheets = findInventoryWorksheets(wb);
  if (inventorySheets.length > 0) {
    let importedInventory = false;
    const emptySheetNames: string[] = [];

    for (const wsInv of inventorySheets) {
      const parsed = parseInventarioSheet(wsInv);
      if (parsed.length === 0) {
        emptySheetNames.push(wsInv.name);
        continue;
      }

      importedInventory = true;
      const result: ImportResult = { sheet: `Inventario (${wsInv.name})`, inserted: 0, skipped: 0, errors: [] };

      for (const row of parsed) {
        const patch: Record<string, unknown> = {};
        if (row.nombre) patch.nombre = row.nombre;
        if (row.categoria) patch.categoria = row.categoria;
        if (row.unidad) patch.unidad = row.unidad;
        if (row.stock_actual !== null) patch.stock_actual = row.stock_actual;
        if (row.stock_minimo !== null) patch.stock_minimo = row.stock_minimo;
        if (row.costo_unitario !== null) patch.costo_unitario = row.costo_unitario;
        if (row.activo !== null) patch.activo = row.activo;

        const updateQuery = supabase
          .from("inventario_productos")
          .update(patch)
          .eq("organization_id", DEFAULT_ORG_ID);
        const { error: updateError, data: updated } = await (row.codigo_generado
          ? updateQuery.eq("nombre", row.nombre)
          : updateQuery.eq("codigo", row.codigo)
        ).select("id");

        if (updateError) {
          result.errors.push(`${row.codigo}: ${updateError.message}`);
        } else if ((updated ?? []).length > 0) {
          result.inserted++;
        } else {
          const { error: insertError } = await supabase.from("inventario_productos").insert({
            organization_id: DEFAULT_ORG_ID,
            codigo: row.codigo,
            nombre: row.nombre || row.codigo,
            categoria: row.categoria || "General",
            unidad: row.unidad || "und",
            stock_actual: row.stock_actual ?? 0,
            stock_minimo: row.stock_minimo ?? 0,
            costo_unitario: row.costo_unitario,
            activo: row.activo ?? true,
          });
          if (insertError) {
            result.errors.push(`${row.codigo}: ${insertError.message}`);
          } else {
            result.inserted++;
          }
        }
      }
      results.push(result);
    }

    if (!importedInventory) {
      results.push({
        sheet: "Inventario",
        inserted: 0,
        skipped: 0,
        errors: [
          `No se detectaron filas de productos en las hojas revisadas: ${emptySheetNames.join(", ")}. Version importador: diagnostic-preview. ${workbookDiagnostic(wb, inventorySheets)}`,
        ],
      });
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se encontraron hojas reconocidas. Asegurate de usar el archivo exportado desde esta misma app (hojas: Compradores, Choferes, Proveedores, Inventario).",
      },
      { status: 400 },
    );
  }

  revalidatePath("/ventas/clientes");
  revalidatePath("/ventas");
  revalidatePath("/inventario");

  return NextResponse.json({ ok: true, results });
}
