import type { CajaVista } from "@/lib/caja-resumen-data";
import { cajaCategoriaLabel, cajaOrigenLabel } from "@/lib/caja-presentacion";

export const CAJA_HISTORY_PAGE_SIZE = 50;
export const CAJA_TIPOS = ["todos", "ingreso", "egreso", "transferencia"] as const;
export const CAJA_MEDIOS = ["todos", "efectivo", "banco", "yape", "otro"] as const;
export const CAJA_COMPROBANTES = ["todos", "factura", "boleta", "recibo", "adjunto", "ninguno"] as const;

export type CajaFiltros = {
  buscar: string;
  desde: string;
  hasta: string;
  tipo: (typeof CAJA_TIPOS)[number];
  medio: (typeof CAJA_MEDIOS)[number];
  comprobante: (typeof CAJA_COMPROBANTES)[number];
  pagina: number;
};
export type CajaSearchParams = Partial<Record<keyof CajaFiltros | "vista", string | string[]>>;
export type CajaMovimientoBuscable = {
  fecha: string;
  tipo: string;
  medio: string;
  categoria: string;
  descripcion: string | null;
  modulo_origen: string | null;
  referencia_id: string | null;
  tipo_comprobante: string | null;
  url_comprobante: string | null;
};

const primero = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
const textoBuscable = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_\s]+/g, " ").trim();

function fechaValida(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
}

export function normalizeCajaFiltros(params: CajaSearchParams = {}): CajaFiltros {
  const tipo = primero(params.tipo);
  const medio = primero(params.medio);
  const comprobante = primero(params.comprobante);
  const pagina = Number(primero(params.pagina));
  return {
    buscar: primero(params.buscar).replace(/\s+/g, " ").slice(0, 160),
    desde: primero(params.desde),
    hasta: primero(params.hasta),
    tipo: CAJA_TIPOS.find(value => value === tipo) ?? "todos",
    medio: CAJA_MEDIOS.find(value => value === medio) ?? "todos",
    comprobante: CAJA_COMPROBANTES.find(value => value === comprobante) ?? "todos",
    pagina: Number.isSafeInteger(pagina) && pagina > 0 && pagina <= Math.floor(Number.MAX_SAFE_INTEGER / CAJA_HISTORY_PAGE_SIZE) ? pagina : 1,
  };
}

export function cajaFiltrosError(filtros: CajaFiltros): string | null {
  if ((filtros.desde && !fechaValida(filtros.desde)) || (filtros.hasta && !fechaValida(filtros.hasta))) return "Revisa las fechas: usa una fecha válida en Desde y Hasta.";
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) return "La fecha Desde debe ser anterior o igual a Hasta.";
  return null;
}

export function cajaTieneFiltros(filtros: CajaFiltros) {
  return Boolean(filtros.buscar || filtros.desde || filtros.hasta || filtros.tipo !== "todos" || filtros.medio !== "todos" || filtros.comprobante !== "todos");
}

export function buildCajaHref(vista: CajaVista, filtros: CajaFiltros, pagina = 1, anchor = true) {
  const params = new URLSearchParams();
  if (vista !== "todos") params.set("vista", vista);
  for (const field of ["buscar", "desde", "hasta"] as const) if (filtros[field]) params.set(field, filtros[field]);
  for (const field of ["tipo", "medio", "comprobante"] as const) if (filtros[field] !== "todos") params.set(field, filtros[field]);
  if (pagina > 1) params.set("pagina", String(normalizeCajaFiltros({ pagina: String(pagina) }).pagina));
  const query = params.toString();
  return `/caja${query ? `?${query}` : ""}${anchor ? "#movimientos-caja" : ""}`;
}

/** Mismo criterio para lo que muestra la tabla y para lo que encuentra el filtro. */
export function cajaComprobante(row: Pick<CajaMovimientoBuscable, "tipo_comprobante" | "descripcion" | "url_comprobante">): Exclude<CajaFiltros["comprobante"], "todos"> {
  if (row.tipo_comprobante === "factura" || row.tipo_comprobante === "boleta") return row.tipo_comprobante;
  if (row.url_comprobante) return "adjunto";
  const descripcion = textoBuscable(row.descripcion ?? "");
  if (descripcion.includes("factura") || descripcion.includes("f001")) return "factura";
  if (descripcion.includes("boleta") || descripcion.includes("b001")) return "boleta";
  if (descripcion.includes("comprobante") || descripcion.includes("recibo") || descripcion.includes("r001")) return "recibo";
  return "ninguno";
}

export const CAJA_COMPROBANTE_LABELS = { factura: "Factura", boleta: "Boleta", recibo: "Recibo", adjunto: "Adjunto", ninguno: "Sin comprobante" } as const;

export function crearFiltroCaja(filtros: CajaFiltros): (row: CajaMovimientoBuscable) => boolean {
  if (cajaFiltrosError(filtros)) return () => false;
  const palabras = textoBuscable(filtros.buscar).split(" ").filter(Boolean);
  return row => {
    if (filtros.desde && row.fecha < filtros.desde) return false;
    if (filtros.hasta && row.fecha > filtros.hasta) return false;
    if (filtros.tipo !== "todos" && row.tipo !== filtros.tipo) return false;
    if (filtros.medio !== "todos" && row.medio !== filtros.medio) return false;
    if (filtros.comprobante !== "todos" && cajaComprobante(row) !== filtros.comprobante) return false;
    if (palabras.length === 0) return true;
    const texto = textoBuscable([row.categoria, cajaCategoriaLabel(row.categoria), row.descripcion, row.modulo_origen, cajaOrigenLabel(row.modulo_origen), row.referencia_id].filter(Boolean).join(" "));
    return palabras.every(palabra => texto.includes(palabra));
  };
}
