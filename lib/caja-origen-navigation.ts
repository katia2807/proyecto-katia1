import { buildCajaHref, cajaFiltrosError, normalizeCajaFiltros } from "@/lib/caja-filtros";

export type CajaOrigenTipo = "venta-madera" | "madera" | "mueble" | "aserradero" | "alquiler" | "cotizacion" | "personalizada";
const origenes: Record<string, CajaOrigenTipo> = {
  ventas_madera: "venta-madera", ventas_pdf: "venta-madera", ventas_madera_cortada: "madera",
  ventas_muebles_terminados: "mueble", ventas_aserradero: "aserradero", aserradero: "aserradero",
  ventas_alquiler: "alquiler", alquiler: "alquiler", cotizacion_unificada: "cotizacion",
  ventas: "personalizada", muebles_corte: "personalizada",
};

export const isCajaReferenceId = (value: string | null | undefined): value is string => Boolean(value && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value));

export function cajaOrigenTipo(modulo: string | null, referencia: string | null): CajaOrigenTipo | null {
  return modulo && isCajaReferenceId(referencia) && Object.hasOwn(origenes, modulo) ? origenes[modulo] : null;
}

/** El regreso permite únicamente Caja y sus filtros conocidos. */
export function safeCajaHref(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw?.startsWith("/caja")) {
    try {
      const url = new URL(raw, "https://katia.local");
      if (url.origin === "https://katia.local" && url.pathname === "/caja") {
        const vista = url.searchParams.get("vista");
        const filtros = normalizeCajaFiltros(Object.fromEntries(["buscar", "desde", "hasta", "tipo", "medio", "comprobante", "pagina"].map(key => [key, url.searchParams.get(key) ?? ""])));
        if (cajaFiltrosError(filtros)) { filtros.desde = ""; filtros.hasta = ""; }
        return buildCajaHref(vista === "empresa" || vista === "personal" ? vista : "todos", filtros, filtros.pagina);
      }
    } catch {
      // Un enlace incompleto vuelve a Caja sin filtros.
    }
  }
  return buildCajaHref("todos", normalizeCajaFiltros());
}

export function cajaOrigenLink(row: { id: string; modulo_origen: string | null; referencia_id: string | null }, volver: string) {
  const tipo = cajaOrigenTipo(row.modulo_origen, row.referencia_id);
  if (!tipo || !isCajaReferenceId(row.id)) return null;
  const params = new URLSearchParams({ volver: safeCajaHref(volver) });
  return {
    href: `/caja/origen/${encodeURIComponent(row.id)}?${params}`,
    label: tipo === "cotizacion" || tipo === "personalizada" ? "Ver cotización relacionada" : "Ver operación relacionada",
  };
}
