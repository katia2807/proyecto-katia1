import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getClientesRows, getChoferesRows } from "@/lib/data";
import { getEmpresaConfig } from "@/lib/company-config";

export type MaderaCortadaRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  tipo_corte: string | null;
  total_pt: number | null;
  precio_por_pt: number | null;
  total: number;
  metodo_pago: string | null;
  modalidad_pago: string | null;
  tipo_entrega: string | null;
  direccion_entrega: string | null;
  estado_entrega: string | null;
  correlativo: string | null;
  costo_envio: number | null;
  created_at: string;
};

export type MuebleTerminadoRow = {
  id: string;
  cliente_id: string;
  mueble_catalogo_id: string | null;
  cantidad: number;
  precio_unitario: number;
  total: number;
  fecha: string;
  modalidad_pago: string | null;
  metodo_pago: string | null;
  tipo_entrega: string | null;
  correlativo: string | null;
  estado: string | null;
  created_at: string;
};

export type ServicioAserraderoRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  pies_cubicos: number;
  costo_cubicaje: number;
  precio_cobrado: number;
  utilidad: number;
  lineas_json: unknown;
  correlativo: string | null;
  metodo_pago?: string | null;
  modalidad_pago?: string | null;
  fecha_pago_credito?: string | null;
  adelanto?: number | null;
  created_at: string;
};

export type VentaMaderaRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  estado: string;
  total: number;
  correlativo: string | null;
  created_at: string;
};

export type VentaMaderaLineaRow = {
  id: string;
  venta_id: string;
  item_id: string | null;
  volumen_m3_o_pies3: number;
  cantidad: number;
  precio_unitario: number;
};

export async function getMaderaCortadaById(id: string): Promise<MaderaCortadaRow | null> {
  if (!hasSupabaseEnv()) {
    const { demoVentasRows } = await import("@/lib/demo-store");
    const found = demoVentasRows().find((v) => v.id === id);
    if (!found) return null;
    return {
      id: found.id,
      cliente_id: found.cliente_id,
      fecha: found.fecha,
      tipo_corte: "tabla",
      total_pt: 10,
      precio_por_pt: found.total / 10,
      total: found.total,
      metodo_pago: "efectivo",
      modalidad_pago: "contado",
      tipo_entrega: "recojo",
      direccion_entrega: null,
      estado_entrega: "entregado",
      correlativo: found.correlativo,
      costo_envio: 0,
      created_at: found.created_at,
    };
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("ventas_madera_cortada")
    .select("*")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  return data ?? null;
}

export async function getMuebleTerminadoById(id: string): Promise<MuebleTerminadoRow | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("ventas_mueble_terminado")
    .select("*")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  return data ?? null;
}

export async function getMuebleNombre(id: string): Promise<string | null> {
  if (!hasSupabaseEnv() || !id) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("muebles_catalogo")
    .select("nombre,codigo")
    .eq("id", id)
    .maybeSingle();
  return data ? `${data.codigo} — ${data.nombre}` : null;
}

export async function getServicioAserraderoById(id: string): Promise<ServicioAserraderoRow | null> {
  if (!hasSupabaseEnv()) {
    const { demoServiciosAserraderoRows } = await import("@/lib/demo-store");
    const found = demoServiciosAserraderoRows().find((s) => s.id === id);
    return found ? (found as unknown as ServicioAserraderoRow) : null;
  }
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("servicios_aserradero")
    .select("*")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  return data ?? null;
}

export async function getVentaMaderaById(id: string): Promise<(VentaMaderaRow & { lineas: VentaMaderaLineaRow[] }) | null> {
  if (!hasSupabaseEnv()) {
    const { demoVentasRows } = await import("@/lib/demo-store");
    const found = demoVentasRows().find((v) => v.id === id);
    if (!found) return null;
    return {
      id: found.id,
      cliente_id: found.cliente_id,
      fecha: found.fecha,
      estado: found.estado,
      total: found.total,
      correlativo: found.correlativo,
      created_at: found.created_at,
      lineas: [
        {
          id: "linea-demo-" + found.id,
          venta_id: found.id,
          item_id: null,
          volumen_m3_o_pies3: 0,
          cantidad: 1,
          precio_unitario: found.total,
        }
      ]
    };
  }
  const supabase = getSupabaseServerClient();
  const { data: venta } = await supabase
    .from("ventas_madera")
    .select("*")
    .eq("id", id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();
  if (!venta) return null;

  const { data: lineas } = await supabase
    .from("ventas_madera_lineas")
    .select("*")
    .eq("venta_id", id);

  return {
    ...venta,
    lineas: lineas ?? [],
  };
}

export async function getProductoMaderaById(id: string) {
  if (!hasSupabaseEnv()) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("productos_madera")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function getAdelantoFromCaja(referenciaId: string): Promise<number> {
  if (!hasSupabaseEnv()) return 0;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("movimientos_caja")
    .select("monto")
    .eq("referencia_id", referenciaId)
    .eq("tipo", "ingreso")
    .maybeSingle();
  return data ? Number(data.monto) : 0;
}

export async function resolveSaleDocument(id: string, searchTipo?: string) {
  // Parallel attempt to resolve from different tables if `searchTipo` is not provided
  let resolvedTipo = searchTipo;
  let data: any = null;

  if (resolvedTipo === "madera") {
    data = await getMaderaCortadaById(id);
  } else if (resolvedTipo === "mueble") {
    data = await getMuebleTerminadoById(id);
  } else if (resolvedTipo === "aserradero") {
    data = await getServicioAserraderoById(id);
  } else if (resolvedTipo === "venta-madera") {
    data = await getVentaMaderaById(id);
  } else {
    // Attempt parallel resolution
    const [madera, mueble, aserradero, ventaMadera] = await Promise.all([
      getMaderaCortadaById(id).catch(() => null),
      getMuebleTerminadoById(id).catch(() => null),
      getServicioAserraderoById(id).catch(() => null),
      getVentaMaderaById(id).catch(() => null),
    ]);

    if (madera) {
      resolvedTipo = "madera";
      data = madera;
    } else if (mueble) {
      resolvedTipo = "mueble";
      data = mueble;
    } else if (aserradero) {
      resolvedTipo = "aserradero";
      data = aserradero;
    } else if (ventaMadera) {
      resolvedTipo = "venta-madera";
      data = ventaMadera;
    }
  }

  return { tipo: resolvedTipo, data };
}
