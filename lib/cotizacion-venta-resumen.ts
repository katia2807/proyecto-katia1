import { parseCotizacionDetalle } from "@/lib/cotizacion-unificada-payload";
import { buildDescripcionComercialSugerida, getDescripcionPersonalizada } from "@/lib/cotizacion-unificada-lineas";
import type { UnifiedVenta } from "@/components/ventas/ventas-list-with-filters";

/** Una propuesta con varios rubros sigue siendo una sola operación por su total. */
export function resumenVentaCotizacion(raw: unknown) {
  const detalle = parseCotizacionDetalle(raw);
  const rubros: { categoria: UnifiedVenta["categoria"]; nombre: string }[] = [];
  if (detalle.rubros.muebles) rubros.push({ categoria: "muebles", nombre: "Muebles personalizados" });
  if (detalle.rubros.aserradero) rubros.push({ categoria: "aserradero", nombre: "Servicio de aserradero" });
  if (detalle.rubros.alquiler) rubros.push({
    categoria: "alquileres", nombre: `Alquiler de ${detalle.alquiler?.nombre_maquinaria.trim() || "maquinaria"}`,
  });
  const descripcion = getDescripcionPersonalizada(detalle) ?? buildDescripcionComercialSugerida(detalle);
  return {
    categoria: rubros.length === 1 ? rubros[0].categoria : "otros" as const,
    rubro: rubros.map(rubro => rubro.nombre).join(" + ") || "Cotización guiada",
    descripcion: descripcion.trim() || null,
  };
}
