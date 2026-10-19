import { DEFAULT_ORG_ID } from "@/lib/constants";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const referencias = [
  { table: "cotizaciones_mueble", label: "cotizaciones de muebles", href: "/ventas/muebles-personalizados" },
  { table: "cotizaciones_unificadas", label: "cotizaciones", href: "/cotizacion" },
  { table: "ventas_madera", label: "ventas de madera", href: "/ventas?categoria=madera#historial-ventas" },
  { table: "ventas_madera_cortada", label: "ventas de madera cortada", href: "/ventas?categoria=madera#historial-ventas" },
  { table: "ventas_mueble_terminado", label: "ventas de muebles terminados", href: "/ventas/muebles-terminados" },
  { table: "servicios_aserradero", label: "servicios de aserradero", href: "/ventas/aserradero-servicios" },
  { table: "alquileres", label: "contratos de alquiler", href: "/ventas/alquiler-mixer" },
  { table: "ordenes_produccion", label: "órdenes de producción", href: "/ventas/muebles-personalizados" },
] as const;

export type ClienteEliminacion = {
  estado: string | null;
  dependencias: { label: string; href: string; count: number }[];
  puedeEliminar: boolean;
};

const errorVerificacion = "No pudimos comprobar los registros vinculados. Actualiza la página e inténtalo de nuevo. No se eliminó el cliente.";

/** Solo lectura. Incluye registros archivados que aún conservan referencias. */
export async function getClienteEliminacion(id: string, organizationId = DEFAULT_ORG_ID): Promise<ClienteEliminacion | null> {
  let estado: string | null;
  let counts: number[];
  if (!hasSupabaseEnv()) {
    const demo = await import("@/lib/demo-store");
    const cliente = demo.demoClientesRows().find(c => c.id === id && c.organization_id === organizationId);
    if (!cliente) return null;
    estado = cliente.estado ?? null;
    const dependencias = demo.demoClienteDependencias(id, organizationId);
    counts = referencias.map(r => dependencias[r.table]);
  } else {
    const supabase = getSupabaseServerClient();
    const signal = AbortSignal.timeout(10_000);
    const { data: cliente, error } = await supabase.from("clientes").select("estado")
      .eq("id", id).eq("organization_id", organizationId).is("deleted_at", null).abortSignal(signal).maybeSingle();
    if (error) throw new Error(errorVerificacion);
    if (!cliente) return null;
    estado = cliente.estado;
    counts = await Promise.all(referencias.map(async ref => {
      const { count, error: relatedError } = await supabase.from(ref.table).select("id", { count: "exact", head: true })
        .eq("cliente_id", id).eq("organization_id", organizationId).abortSignal(signal);
      if (relatedError || count === null) throw new Error(errorVerificacion);
      return count;
    }));
  }
  const dependencias = referencias.map((ref, index) => ({ label: ref.label, href: ref.href, count: counts[index] })).filter(r => r.count > 0);
  return { estado, dependencias, puedeEliminar: estado !== "activo" && dependencias.length === 0 };
}
