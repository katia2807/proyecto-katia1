import { notFound } from "next/navigation";
import Image from "next/image";
import { getEmpresaConfig } from "@/lib/company-config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getClientesRows, getChoferesRows } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/runtime";
import { formatPen } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";

type Params = { tipo: string; id: string };

function fmt(date: string) {
  try {
    return new Date(date).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return date;
  }
}

type MaderaCortadaRow = {
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

type MuebleTerminadoRow = {
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

type ServicioAserraderoRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  pies_cubicos: number;
  costo_cubicaje: number;
  precio_cobrado: number;
  utilidad: number;
  lineas_json: any;
  correlativo: string | null;
  created_at: string;
};

type VentaMaderaRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  estado: string;
  total: number;
  correlativo: string | null;
  created_at: string;
};

type VentaMaderaLineaRow = {
  id: string;
  venta_id: string;
  item_id: string | null;
  volumen_m3_o_pies3: number;
  cantidad: number;
  precio_unitario: number;
};

async function getMaderaCortadaById(id: string): Promise<MaderaCortadaRow | null> {
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

async function getMuebleTerminadoById(id: string): Promise<MuebleTerminadoRow | null> {
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

async function getMuebleNombre(id: string): Promise<string | null> {
  if (!hasSupabaseEnv() || !id) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("muebles_catalogo")
    .select("nombre,codigo")
    .eq("id", id)
    .maybeSingle();
  return data ? `${data.codigo} — ${data.nombre}` : null;
}

async function getServicioAserraderoById(id: string): Promise<ServicioAserraderoRow | null> {
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

async function getVentaMaderaById(id: string): Promise<(VentaMaderaRow & { lineas: VentaMaderaLineaRow[] }) | null> {
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

async function getProductoMaderaById(id: string) {
  if (!hasSupabaseEnv()) return null;
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("productos_madera")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComprobantePage({ params }: { params: Promise<Params> }) {
  const { tipo, id } = await params;

  if (!["madera", "mueble", "aserradero", "venta-madera"].includes(tipo)) notFound();

  const [empresa, clientes, choferes] = await Promise.all([
    getEmpresaConfig(),
    getClientesRows(),
    getChoferesRows(),
  ]);

  const clienteMap = new Map(clientes.map((c) => [c.id, c]));
  const choferMap  = new Map(choferes.map((c) => [c.id, c.nombre]));

  let correlativo = "—";
  let fechaVenta  = "—";
  let clienteNombre = "—";
  let clienteDoc    = "—";
  let items: Array<{ desc: string; qty: string; unitario: string; total: string }> = [];
  let totalSoles    = 0;
  let modalidad     = "—";
  let metodo        = "—";
  let entrega       = "—";

  // New states for specific types
  let aserraderoServicio: ServicioAserraderoRow | null = null;
  let aserraderoLineasEspeciales: Array<{ id: string; codigo: string; nombre: string; cantidad: number; tarifa: number; subtotal: number }> = [];

  let ventaMadera: VentaMaderaRow & { lineas: VentaMaderaLineaRow[] } | null = null;
  let ventaMaderaLineasResueltas: Array<{ desc: string; qty: string; unidad: string; unitario: string; total: string }> = [];

  if (tipo === "aserradero") {
    aserraderoServicio = await getServicioAserraderoById(id);
    if (!aserraderoServicio) notFound();

    correlativo = aserraderoServicio.correlativo ?? aserraderoServicio.id.slice(0, 8).toUpperCase();
    fechaVenta  = fmt(aserraderoServicio.fecha);
    totalSoles  = Number(aserraderoServicio.precio_cobrado);
    modalidad   = "Contado";
    metodo      = "efectivo";
    entrega     = "recojo";

    const cli     = clienteMap.get(aserraderoServicio.cliente_id);
    clienteNombre = cli?.nombre ?? "—";
    clienteDoc    = cli?.documento ?? cli?.ruc ?? "—";

    if (aserraderoServicio.lineas_json) {
      try {
        const parsed = typeof aserraderoServicio.lineas_json === "string" 
          ? JSON.parse(aserraderoServicio.lineas_json) 
          : aserraderoServicio.lineas_json;
        if (Array.isArray(parsed)) {
          aserraderoLineasEspeciales = parsed;
        }
      } catch (e) {
        console.error("Error parsing lineas_json", e);
      }
    }
  } else if (tipo === "venta-madera") {
    ventaMadera = await getVentaMaderaById(id);
    if (!ventaMadera) notFound();

    correlativo = ventaMadera.correlativo ?? ventaMadera.id.slice(0, 8).toUpperCase();
    fechaVenta  = fmt(ventaMadera.fecha);
    totalSoles  = Number(ventaMadera.total);
    modalidad   = ventaMadera.estado === "confirmada" ? "contado" : "—";
    metodo      = "efectivo";
    entrega     = "entrega local";

    const cli     = clienteMap.get(ventaMadera.cliente_id);
    clienteNombre = cli?.nombre ?? "—";
    clienteDoc    = cli?.documento ?? cli?.ruc ?? "—";

    for (const linea of ventaMadera.lineas) {
      let desc = "Venta de madera";
      let unidad = "pies3";
      if (linea.item_id) {
        const prod = await getProductoMaderaById(linea.item_id);
        if (prod) {
          desc = prod.nombre + (prod.especie ? ` (${prod.especie})` : "");
          unidad = prod.unidad_base || "pies3";
        }
      }
      ventaMaderaLineasResueltas.push({
        desc,
        qty: String(linea.cantidad),
        unidad,
        unitario: formatPen(Number(linea.precio_unitario)),
        total: formatPen(Number(linea.cantidad * linea.precio_unitario)),
      });
    }
  } else if (tipo === "madera") {
    const venta = await getMaderaCortadaById(id);
    if (!venta) notFound();

    correlativo    = venta.correlativo ?? venta.id.slice(0, 8).toUpperCase();
    fechaVenta     = fmt(venta.fecha);
    totalSoles     = Number(venta.total);
    modalidad      = venta.modalidad_pago ?? "—";
    metodo         = venta.metodo_pago ?? "—";
    entrega        = venta.tipo_entrega ?? "—";

    const cli      = clienteMap.get(venta.cliente_id);
    clienteNombre  = cli?.nombre ?? "—";
    clienteDoc     = cli?.documento ?? cli?.ruc ?? "—";

    const pt       = Number(venta.total_pt ?? 0).toFixed(2);
    const ppt      = Number(venta.precio_por_pt ?? 0);
    const tipoCorte = (venta.tipo_corte ?? "madera").replace(/_/g, " ");
    items = [
      {
        desc: `Venta de madera cortada — ${tipoCorte}`,
        qty: `${pt} PT`,
        unitario: formatPen(ppt) + "/PT",
        total: formatPen(totalSoles),
      },
    ];
    if (venta.costo_envio && Number(venta.costo_envio) > 0) {
      items.push({
        desc: "Costo de envío",
        qty: "1",
        unitario: formatPen(Number(venta.costo_envio)),
        total: formatPen(Number(venta.costo_envio)),
      });
    }
    if (venta.tipo_entrega && venta.tipo_entrega !== "recojo" && venta.direccion_entrega) {
      entrega = `${venta.tipo_entrega} — ${venta.direccion_entrega}`;
    }
  } else {
    const venta = await getMuebleTerminadoById(id);
    if (!venta) notFound();

    correlativo   = venta.correlativo ?? venta.id.slice(0, 8).toUpperCase();
    fechaVenta    = fmt(venta.fecha);
    totalSoles    = Number(venta.total);
    modalidad     = venta.modalidad_pago ?? "—";
    metodo        = venta.metodo_pago ?? "—";
    entrega       = venta.tipo_entrega ?? "—";

    const cli     = clienteMap.get(venta.cliente_id);
    clienteNombre = cli?.nombre ?? "—";
    clienteDoc    = cli?.documento ?? cli?.ruc ?? "—";

    const muebleNombre = venta.mueble_catalogo_id
      ? ((await getMuebleNombre(venta.mueble_catalogo_id)) ?? "Mueble")
      : "Mueble";
    items = [
      {
        desc: muebleNombre,
        qty: String(venta.cantidad),
        unitario: formatPen(Number(venta.precio_unitario)),
        total: formatPen(totalSoles),
      },
    ];
  }

  return (
    <>
      {/* Print + theme CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: #0f172a !important; }
          @page { margin: 14mm; }
          .voucher-card { background: white !important; color: #0f172a !important; }
          .voucher-section { border-color: #e2e8f0 !important; }
          .voucher-label { color: #64748b !important; }
          .voucher-value { color: #1e293b !important; }
          .voucher-th { color: #64748b !important; border-color: #e2e8f0 !important; }
          .voucher-td { color: #1e293b !important; }
          .voucher-total-line { border-color: #334155 !important; color: #0f172a !important; }
        }
        body { background: var(--color-bg, #f1f5f9); }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-4 bg-[var(--color-surface,#1e293b)] border-b border-[var(--color-border,#334155)] px-6 py-3 shadow">
        <a href="javascript:history.back()" className="text-sm text-[var(--color-text-secondary,#94a3b8)] hover:text-[var(--color-text-primary,#f8fafc)] transition-colors">
          ← Volver
        </a>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-secondary,#94a3b8)]">Comprobante #{correlativo}</span>
          <PrintButton />
        </div>
      </div>

      {/* Voucher */}
      <div className="mx-auto max-w-[680px] p-8 font-sans text-[13px]">
        <div className="voucher-card rounded-2xl bg-[var(--color-surface,#ffffff)] text-[var(--color-text-primary,#0f172a)] shadow-lg ring-1 ring-[var(--color-border,#e2e8f0)] p-8">

          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              {empresa.logo_url ? (
                <Image
                  src={empresa.logo_url}
                  alt={empresa.nombre}
                  width={140}
                  height={56}
                  className="mb-2 object-contain"
                  unoptimized
                />
              ) : null}
              <p className="text-base font-bold uppercase tracking-wide text-[var(--color-text-primary,#0f172a)]">{empresa.nombre}</p>
              <p className="text-[11px] text-[var(--color-text-secondary,#64748b)]">RUC: {empresa.ruc}</p>
              {empresa.direccion ? <p className="text-[11px] text-[var(--color-text-secondary,#64748b)]">{empresa.direccion}</p> : null}
              {empresa.telefono ? <p className="text-[11px] text-[var(--color-text-secondary,#64748b)]">Tel: {empresa.telefono}</p> : null}
            </div>

            {/* Voucher box */}
            <div className="rounded-xl border-2 border-[var(--color-border,#334155)] px-5 py-3 text-center">
              <div className="no-print mb-2 flex gap-2">
                <span className="rounded bg-[var(--color-accent,#3b82f6)] px-2 py-0.5 text-xs font-semibold text-white">BOLETA</span>
                <span className="rounded border border-[var(--color-border,#e2e8f0)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary,#64748b)]">FACTURA</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary,#64748b)]">COMPROBANTE DE VENTA</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary,#0f172a)]">#{correlativo}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary,#64748b)]">{fechaVenta}</p>
            </div>
          </div>

          {/* Client */}
          <div className="voucher-section mt-6 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Datos del cliente</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="voucher-label text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#94a3b8)]">Nombre / Razón social</p>
                <p className="voucher-value mt-0.5 text-sm font-medium text-[var(--color-text-primary,#1e293b)]">{clienteNombre}</p>
              </div>
              <div>
                <p className="voucher-label text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#94a3b8)]">DNI / RUC</p>
                <p className="voucher-value mt-0.5 text-sm font-medium text-[var(--color-text-primary,#1e293b)]">{clienteDoc}</p>
              </div>
            </div>
          </div>

          {/* Detalle Conditional Rendering based on tipo */}
          {tipo === "aserradero" && aserraderoServicio && (
            <>
              {/* Detalle de Cubicaje (Piezas) */}
              <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Detalle de piezas (Cubicaje Base)</p>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="voucher-th w-1/3 border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-left">Descripción</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Cant.</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Espesor (in)</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Ancho (in)</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Largo (ft)</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">PT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]">
                      <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-left">Servicio de cubicaje base ({Number(aserraderoServicio.pies_cubicos).toFixed(2)} ft³)</td>
                      <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">1</td>
                      <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">—</td>
                      <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">—</td>
                      <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">—</td>
                      <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right font-semibold">{(Number(aserraderoServicio.pies_cubicos) * 12).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Servicios Especiales Aplicados */}
              <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Servicios especiales aplicados</p>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="voucher-th w-1/2 border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-left">Servicio</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Cant.</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Tarifa</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aserraderoLineasEspeciales.map((linea, i) => (
                      <tr key={linea.id} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-left">{linea.nombre}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{linea.cantidad}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{formatPen(linea.tarifa)}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right font-semibold">{formatPen(linea.subtotal)}</td>
                      </tr>
                    ))}
                    {aserraderoLineasEspeciales.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="voucher-td py-2 text-sm text-center text-[var(--color-text-secondary,#64748b)]">Ningún servicio especial aplicado.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {/* Resumen financiero detallado */}
              <div className="mt-4 flex justify-between gap-4">
                <div className="text-[11px] text-[var(--color-text-secondary,#64748b)] p-3 rounded-lg border border-[var(--color-border,#e2e8f0)] bg-[var(--color-primary-soft,rgba(0,0,0,0.02))]">
                  <p><strong>Costo de Cubicaje (Base):</strong> {formatPen(Number(aserraderoServicio.costo_cubicaje))}</p>
                  <p className="text-[var(--color-success,#10b981)] font-semibold mt-1"><strong>Utilidad estimada:</strong> {formatPen(Number(aserraderoServicio.utilidad))}</p>
                </div>
                <div className="w-64">
                  <div className="voucher-total-line flex justify-between border-t border-[var(--color-border,#334155)] pt-2 text-base font-bold text-[var(--color-text-primary,#0f172a)]">
                    <span>PRECIO COBRADO</span>
                    <span>{formatPen(totalSoles)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {tipo === "venta-madera" && ventaMadera && (
            <>
              {/* Detalle Venta Madera */}
              <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Detalle de Venta</p>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="voucher-th w-1/2 border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-left">Especie de madera / Descripción</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Cant.</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Unidad</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Precio unit.</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventaMaderaLineasResueltas.map((linea, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-left">{linea.desc}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{linea.qty}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right font-medium text-[var(--color-text-secondary,#64748b)] capitalize">{linea.unidad}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{linea.unitario}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right font-semibold">{linea.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-64">
                  <div className="voucher-total-line flex justify-between border-t border-[var(--color-border,#334155)] pt-2 text-base font-bold text-[var(--color-text-primary,#0f172a)]">
                    <span>TOTAL</span>
                    <span>{formatPen(totalSoles)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {["madera", "mueble"].includes(tipo) && (
            <>
              {/* Detalle Mueble o Madera Cortada */}
              <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Detalle</p>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="voucher-th w-1/2 border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-left">Descripción</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Cant.</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Precio unit.</th>
                      <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)]">{item.desc}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{item.qty}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{item.unitario}</td>
                        <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right font-semibold">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="mt-4 flex justify-end">
                <div className="w-64">
                  <div className="voucher-total-line flex justify-between border-t border-[var(--color-border,#334155)] pt-2 text-base font-bold text-[var(--color-text-primary,#0f172a)]">
                    <span>TOTAL</span>
                    <span>{formatPen(totalSoles)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Payment + delivery info */}
          <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4 grid grid-cols-3 gap-4">
            <div>
              <p className="voucher-label text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#94a3b8)]">Modalidad de pago</p>
              <p className="voucher-value mt-0.5 text-sm font-medium text-[var(--color-text-primary,#1e293b)] capitalize">{modalidad}</p>
            </div>
            <div>
              <p className="voucher-label text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#94a3b8)]">Método de pago</p>
              <p className="voucher-value mt-0.5 text-sm font-medium text-[var(--color-text-primary,#1e293b)] capitalize">{metodo}</p>
            </div>
            <div>
              <p className="voucher-label text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#94a3b8)]">Entrega</p>
              <p className="voucher-value mt-0.5 text-sm font-medium text-[var(--color-text-primary,#1e293b)] capitalize">{entrega}</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
