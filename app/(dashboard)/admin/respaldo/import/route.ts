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

function num(v: ExcelJS.CellValue): number | null {
  const s = str(v);
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function rowValues(row: ExcelJS.Row): ExcelJS.CellValue[] {
  const vals: ExcelJS.CellValue[] = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    vals[col - 1] = cell.value;
  });
  return vals;
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
  nombre: string;
  categoria: string | null;
  unidad: string | null;
  stock_minimo: number | null;
  costo_unitario_promedio: number | null;
}> {
  const rows: ReturnType<typeof parseInventarioSheet> = [];
  let dataStart = false;
  ws.eachRow((row) => {
    const vals = rowValues(row);
    const first = str(vals[0]).toLowerCase();
    if (!dataStart && (first === "código" || first === "codigo" || first.includes("digo"))) {
      dataStart = true;
      return;
    }
    if (!dataStart) return;
    const codigo = str(vals[0]);
    if (!codigo || codigo.startsWith("Generado")) return;
    rows.push({
      codigo,
      nombre: str(vals[1]) || codigo,
      categoria: str(vals[2]) !== "—" ? str(vals[2]) || null : null,
      unidad: str(vals[3]) !== "—" ? str(vals[3]) || null : null,
      stock_minimo: num(vals[5]),
      costo_unitario_promedio: num(vals[6]),
    });
  });
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

  // ── Inventario (solo actualiza productos existentes por código) ───────────
  const wsInv = wb.getWorksheet("📦 Inventario") ?? wb.getWorksheet("Inventario");
  if (wsInv) {
    const parsed = parseInventarioSheet(wsInv);
    const result: ImportResult = { sheet: "Inventario", inserted: 0, skipped: 0, errors: [] };

    for (const row of parsed) {
      const patch: Record<string, unknown> = {};
      if (row.categoria) patch.categoria = row.categoria;
      if (row.unidad) patch.unidad = row.unidad;
      if (row.stock_minimo !== null) patch.stock_minimo = row.stock_minimo;
      if (row.costo_unitario_promedio !== null) patch.costo_unitario_promedio = row.costo_unitario_promedio;
      if (Object.keys(patch).length === 0) {
        result.skipped++;
        continue;
      }
      const { error, count } = await supabase
        .from("inventario_productos")
        .update(patch)
        .eq("codigo", row.codigo)
        .eq("organization_id", DEFAULT_ORG_ID)
        .select("id");
      if (error) {
        result.errors.push(`${row.codigo}: ${error.message}`);
      } else if ((count ?? 0) === 0) {
        result.skipped++;
      } else {
        result.inserted++;
      }
    }
    results.push(result);
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
