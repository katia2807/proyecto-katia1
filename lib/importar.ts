import ExcelJS from "exceljs";

export type FilaImportada = Record<string, string>;

export type LeerFilasOptions = {
  /** Si existe una hoja con este nombre (sin distinguir mayúsculas), se usa en lugar de la primera. */
  sheetName?: string;
};

function celdaAString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) {
    return String((v as { text?: unknown }).text ?? "");
  }
  if (typeof v === "object" && v !== null && "result" in (v as Record<string, unknown>)) {
    return celdaAString((v as { result?: unknown }).result);
  }
  return String(v);
}

/** Convierte el contenido de un Buffer (CSV o XLSX) en un arreglo de filas con headers normalizados. */
export async function leerFilas(file: File, opts?: LeerFilasOptions): Promise<FilaImportada[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";

  if (ext === "csv") {
    return parseCSV(buffer.toString("utf8"));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  let sheet = workbook.worksheets[0];
  if (opts?.sheetName?.trim()) {
    const want = opts.sheetName.trim().toLowerCase();
    const found = workbook.worksheets.find((w) => w.name.trim().toLowerCase() === want);
    if (found) sheet = found;
  }
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = normalizarHeader(celdaAString(cell.value));
  });

  const filas: FilaImportada[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: FilaImportada = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const key = headers[col - 1];
      if (!key) return;
      obj[key] = celdaAString(cell.value);
    });
    if (Object.values(obj).some((x) => x.trim() !== "")) filas.push(obj);
  });

  return filas;
}

function normalizarHeader(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[áä]/g, "a")
    .replace(/[éë]/g, "e")
    .replace(/[íï]/g, "i")
    .replace(/[óö]/g, "o")
    .replace(/[úü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9_]/g, "");
}

/** Parser mínimo de CSV con soporte para comillas dobles y comas en campos. */
function parseCSV(input: string): FilaImportada[] {
  const lineas: string[][] = [];
  let actual: string[] = [];
  let buffer = "";
  let dentroComillas = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (dentroComillas) {
      if (ch === '"' && input[i + 1] === '"') {
        buffer += '"';
        i += 1;
      } else if (ch === '"') {
        dentroComillas = false;
      } else {
        buffer += ch;
      }
    } else {
      if (ch === '"') {
        dentroComillas = true;
      } else if (ch === ",") {
        actual.push(buffer);
        buffer = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i += 1;
        actual.push(buffer);
        buffer = "";
        if (actual.some((c) => c.trim() !== "")) lineas.push(actual);
        actual = [];
      } else {
        buffer += ch;
      }
    }
  }
  if (buffer !== "" || actual.length > 0) {
    actual.push(buffer);
    if (actual.some((c) => c.trim() !== "")) lineas.push(actual);
  }

  if (lineas.length === 0) return [];
  const headers = lineas[0].map(normalizarHeader);
  return lineas.slice(1).map((cols) => {
    const obj: FilaImportada = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? "").trim();
    });
    return obj;
  });
}
