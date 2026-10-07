import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { readCompleteTable } from "@/lib/complete-data";
import { requireApiAuth } from "@/lib/api-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/runtime";
import { fechaHoyPeru } from "@/lib/utils";
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
  return null;
}

// ── Sheet parsers ─────────────────────────────────────────────────────────────

type ImportResult = {
  sheet: string;
  inserted: number;
  updated?: number;
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
    codigo: number | null;
    nombre: number | null;
    categoria: number | null;
    unidad: number | null;
    activo: number | null;
    stockActual: number | null;
    stockMinimo: number | null;
    costoUnitario: number | null;
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
          codigo,
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
            "costo registrado",
            "costo unit prom",
            "costo unitario promedio",
            "costo unitario",
            "costo unit",
            "costo",
            "precio costo",
            "precio compra",
          ]),
        };
        return;
      }

      return;
    }

    const codigoOriginal = columns.codigo === null ? "" : str(vals[columns.codigo]);
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


  return rows;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner_admin", "gerencia"]);
  if (auth.response) return auth.response;
  const organizationId = auth.context.organizationId;

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
  if (!ext.endsWith(".xlsx")) {
    return NextResponse.json({ ok: false, error: "Solo se aceptan archivos .xlsx. Guarda el Excel antiguo en ese formato antes de subirlo." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "El archivo supera 10 MB." }, { status: 400 });

  const arrayBuf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(arrayBuf as any);
  } catch {
    return NextResponse.json({ ok: false, error: "El archivo no es un Excel válido." }, { status: 400 });
  }

  let existingClientes, existingChoferes, existingProveedores;
  try {
    [existingClientes,existingChoferes,existingProveedores] = await Promise.all([readCompleteTable("clientes",organizationId),readCompleteTable("choferes",organizationId),readCompleteTable("proveedores",organizationId)]);
  } catch { return NextResponse.json({ok:false,error:"No se pudieron comprobar los registros existentes. No se importaron filas."},{status:503}); }
  const supabase = getSupabaseServerClient();
  const results: ImportResult[] = [];

  // ── Compradores ───────────────────────────────────────────────────────────
  const wsC = wb.getWorksheet("👥 Compradores") ?? wb.getWorksheet("Compradores");
  if (wsC) {
    const parsed = parseCompradoresSheet(wsC);
    const result: ImportResult = { sheet: "Compradores", inserted: 0, skipped: 0, errors: [] };

    // Load existing names to skip duplicates
    const existingNames = new Set(existingClientes.map(r=>r.nombre.toLowerCase().trim()));

    for (const row of parsed) {
      if (existingNames.has(row.nombre.toLowerCase().trim())) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("clientes").insert({
        organization_id: organizationId,
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

    const existingNames = new Set(existingChoferes.map(r=>r.nombre.toLowerCase().trim()));

    for (const row of parsed) {
      if (existingNames.has(row.nombre.toLowerCase().trim())) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("choferes").insert({
        organization_id: organizationId,
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

    const existingNames = new Set(existingProveedores.map(r=>r.nombre.toLowerCase().trim()));

    for (const row of parsed) {
      if (existingNames.has(row.nombre.toLowerCase().trim())) {
        result.skipped++;
        continue;
      }
      const { error } = await supabase.from("proveedores").insert({
        organization_id: organizationId,
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

      result.updated = 0;
      for (const row of parsed) {
        if ([row.stock_actual,row.stock_minimo,row.costo_unitario].some(value=>value !== null && (!Number.isFinite(value) || value < 0))) { result.errors.push(`${row.codigo}: stock o costo inválido.`); continue; }
        const {data:operation,error} = await supabase.rpc("importar_producto_inventario",{
          p_organization_id:organizationId,p_user_id:auth.context.userId,p_producto:{codigo:row.codigo,nombre:row.nombre,categoria:row.categoria,unidad:row.unidad,stock_actual:row.stock_actual,stock_minimo:row.stock_minimo,costo_unitario:row.costo_unitario,activo:row.activo},p_por_nombre:row.codigo_generado,p_fecha:fechaHoyPeru(),
        });
        if (error) result.errors.push(`${row.codigo}: no se pudo guardar producto y Kardex juntos. Comprueba la actualización de base de datos o revisa esta fila.`);
        else if(operation === "updated") result.updated++;
        else if(operation === "inserted") result.inserted++;
        else result.errors.push(`${row.codigo}: resultado no confirmado; revisa antes de reintentar.`);
      }
      results.push(result);
    }

    if (!importedInventory) {
      results.push({
        sheet: "Inventario",
        inserted: 0,
        skipped: 0,
        errors: [
          `No se detectaron filas con encabezados claros en: ${emptySheetNames.join(", ")}. Usa columnas Producto o Nombre, Código y Stock; identifica el costo expresamente como Costo.`,
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
