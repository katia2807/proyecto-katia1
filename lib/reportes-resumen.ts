import { cajaCategoriaLabel, cajaTipoLabel, cajaMedioLabel, cajaOrigenLabel } from "@/lib/caja-presentacion";
import { formatDate, roundMoney } from "@/lib/utils";

export type ReportesResumenFiltros = { desde: string; hasta: string; categoria: string; ambito: "todos" | "empresa" | "personal" };
export type ReportesResumenParams = Partial<Record<keyof ReportesResumenFiltros | "tab", string | string[]>>;
export type ReportesMovimiento = { id: string; fecha: string; categoria: string; tipo: string; monto: number; medio: string; es_personal: boolean; descripcion: string | null; modulo_origen: string | null; deleted_at?: string | null; voided_at?: string | null };

const primero = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
export function normalizeReportesResumen(params: ReportesResumenParams = {}): ReportesResumenFiltros {
  const ambito = primero(params.ambito);
  return { desde: primero(params.desde), hasta: primero(params.hasta), categoria: primero(params.categoria), ambito: ambito === "empresa" || ambito === "personal" ? ambito : "todos" };
}
function fechaValida(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
}
export function reportesResumenError(filtros: ReportesResumenFiltros): string | null {
  if ((filtros.desde && !fechaValida(filtros.desde)) || (filtros.hasta && !fechaValida(filtros.hasta))) return "Usa fechas válidas en Desde y Hasta.";
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) return "Desde debe ser anterior o igual a Hasta.";
  return null;
}
export function reportesResumenQuery(filtros: ReportesResumenFiltros): string {
  const params = new URLSearchParams();
  for (const key of ["desde", "hasta", "categoria"] as const) if (filtros[key]) params.set(key, filtros[key]);
  if (filtros.ambito !== "todos") params.set("ambito", filtros.ambito);
  return params.toString();
}

export function buildReportesResumen<T extends ReportesMovimiento>(rows: T[], filtros: ReportesResumenFiltros) {
  const error = reportesResumenError(filtros);
  if (error) throw new Error(error);
  const movimientos = rows.filter(row => !row.deleted_at && !row.voided_at &&
    (!filtros.desde || row.fecha.slice(0, 10) >= filtros.desde) &&
    (!filtros.hasta || row.fecha.slice(0, 10) <= filtros.hasta) &&
    (!filtros.categoria || row.categoria === filtros.categoria) &&
    (filtros.ambito === "todos" || (filtros.ambito === "personal" ? row.es_personal : !row.es_personal)))
    .sort((a,b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  const categorias = new Map<string, { categoria: string; esPersonal: boolean; movimientos: number; ingresos: number; gastos: number; transferencias: number; resultado: number }>();
  let ingresos = 0, gastos = 0, transferencias = 0;
  for (const row of movimientos) {
    const monto = Number(row.monto);
    if (!Number.isFinite(monto) || monto < 0 || !["ingreso", "egreso", "transferencia"].includes(row.tipo)) throw new Error("Hay un movimiento inválido; no se entregó un resumen parcial.");
    const key = `${row.es_personal ? "personal" : "empresa"}:${row.categoria}`;
    const grupo = categorias.get(key) ?? { categoria: row.categoria, esPersonal: row.es_personal, movimientos: 0, ingresos: 0, gastos: 0, transferencias: 0, resultado: 0 };
    grupo.movimientos++;
    if (row.tipo === "ingreso") { grupo.ingresos = roundMoney(grupo.ingresos + monto); ingresos = roundMoney(ingresos + monto); }
    else if (row.tipo === "egreso") { grupo.gastos = roundMoney(grupo.gastos + monto); gastos = roundMoney(gastos + monto); }
    else { grupo.transferencias++; transferencias++; }
    grupo.resultado = roundMoney(grupo.ingresos - grupo.gastos);
    categorias.set(key, grupo);
  }
  return { movimientos, categorias: [...categorias.values()].sort((a,b) => cajaCategoriaLabel(a.categoria).localeCompare(cajaCategoriaLabel(b.categoria), "es") || Number(a.esPersonal) - Number(b.esPersonal)), ingresos, gastos, transferencias, resultado: roundMoney(ingresos - gastos) };
}
export type ReportesResumen = ReturnType<typeof buildReportesResumen>;

export function reportesResumenAlcance(filtros: ReportesResumenFiltros) {
  const fechas = filtros.desde || filtros.hasta ? `Desde ${filtros.desde ? formatDate(filtros.desde) : "el inicio"} hasta ${filtros.hasta ? formatDate(filtros.hasta) : "la última fecha"}` : "Todo el historial";
  return `${fechas} · ${filtros.ambito === "todos" ? "Empresa y personal" : filtros.ambito === "empresa" ? "Empresa" : "Personal"} · ${filtros.categoria ? cajaCategoriaLabel(filtros.categoria) : "Todas las categorías"}`;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Evita fórmulas al abrir texto escrito por usuarios en una hoja de cálculo.
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function reportesResumenCsv(resumen: ReportesResumen) {
  const rows: unknown[][] = [["Fecha", "Tipo", "Categoría", "Ámbito", "Medio", "Monto", "Origen", "Descripción"]];
  for (const row of resumen.movimientos) rows.push([row.fecha, cajaTipoLabel(row.tipo), cajaCategoriaLabel(row.categoria), row.es_personal ? "Personal" : "Empresa", cajaMedioLabel(row.medio), Number(row.monto), cajaOrigenLabel(row.modulo_origen), row.descripcion]);
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
