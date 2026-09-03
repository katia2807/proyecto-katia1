import { notFound } from "next/navigation";
import Image from "next/image";
import { getEmpresaConfig } from "@/lib/company-config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getClientesRows, getChoferesRows } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/runtime";
import { formatPen } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";
import { PrintSelector } from "@/components/ui/print-selector";
import { buildAserraderoPrintModel } from "@/lib/aserradero-print-model";
import { AserraderoPrintA4Detail } from "@/components/sales/aserradero-print-a4-detail";
import { buildMaderaCortadaPrintModel } from "@/lib/madera-cortada-print-model";


type Params = { tipo: string; id: string };

function fmt(date: string) {
  try {
    return new Date(date).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return date;
  }
}
const decorativeQrCells = [
  1, 1, 1, 0, 1, 0, 1, 1, 1,
  1, 0, 1, 0, 1, 1, 1, 0, 1,
  1, 1, 1, 0, 0, 0, 1, 1, 1,
  0, 0, 0, 1, 1, 0, 0, 1, 0,
  1, 0, 1, 1, 0, 1, 1, 0, 1,
  0, 1, 0, 0, 1, 1, 0, 0, 0,
  1, 1, 1, 0, 1, 0, 1, 1, 1,
  1, 0, 1, 1, 1, 0, 1, 0, 1,
  1, 1, 1, 0, 1, 1, 1, 1, 1,
];

function DecorativeQr({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid shrink-0 rounded-md border border-[var(--color-border,#e2e8f0)] bg-white p-1 ${className}`}
      style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}
      aria-label="QR decorativo"
    >
      {decorativeQrCells.map((cell, index) => (
        <span key={index} className={cell ? "aspect-square bg-slate-900" : "aspect-square bg-white"} />
      ))}
    </div>
  );
}
type MaderaCortadaRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  tipo_corte: string | null;
  total_pt: number | null;
  precio_por_pt: number | null;
  cantidad_piezas?: number | null;
  precio_unitario_comercial?: number | null;
  lineas_comprobante?: unknown;
  tipo_comprobante?: "boleta" | "factura" | "ninguno";
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
  lineas_json: unknown;
  correlativo: string | null;
  metodo_pago?: string | null;
  modalidad_pago?: string | null;
  fecha_pago_credito?: string | null;
  adelanto?: number | null;
  created_at: string;
};

type LineaCubicajeAserradero = {
  id?: string | number;
  tipo?: string;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  ptUnitarioComercial?: number;
  ptTotalComercial?: number;
};

function esLineaCubicajeAserradero(linea: unknown): linea is LineaCubicajeAserradero {
  if (!linea || typeof linea !== "object") return false;
  const item = linea as Record<string, unknown>;
  return (
    typeof item.cantidad === "number" &&
    Number.isFinite(item.cantidad) &&
    item.cantidad > 0 &&
    typeof item.espesor === "number" &&
    Number.isFinite(item.espesor) &&
    item.espesor > 0 &&
    typeof item.ancho === "number" &&
    Number.isFinite(item.ancho) &&
    item.ancho > 0 &&
    typeof item.largo === "number" &&
    Number.isFinite(item.largo) &&
    item.largo > 0
  );
}

function getPTComercialLinea(linea: LineaCubicajeAserradero) {
  if (typeof linea.ptTotalComercial === "number" && Number.isFinite(linea.ptTotalComercial)) {
    return linea.ptTotalComercial;
  }
  if (typeof linea.ptUnitarioComercial === "number" && Number.isFinite(linea.ptUnitarioComercial)) {
    return linea.ptUnitarioComercial * linea.cantidad;
  }
  return Math.floor((linea.espesor * linea.ancho * linea.largo) / 12) * linea.cantidad;
}

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
      tipo_corte: found.tipo_corte ?? "tabla",
      total_pt: found.total_pt ?? 0,
      precio_por_pt: found.precio_por_pt ?? 0,
      cantidad_piezas: found.cantidad_piezas ?? null,
      precio_unitario_comercial: found.precio_unitario_comercial ?? null,
      lineas_comprobante: found.lineas_comprobante ?? [],
      tipo_comprobante: found.tipo_comprobante ?? "ninguno",
      total: found.total,
      metodo_pago: found.metodo_pago ?? null,
      modalidad_pago: found.modalidad_pago ?? null,
      tipo_entrega: found.tipo_entrega ?? null,
      direccion_entrega: found.direccion_entrega ?? null,
      estado_entrega: found.estado_entrega ?? null,
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

async function getAdelantoFromCaja(referenciaId: string): Promise<number> {
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComprobantePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tipo, id } = await params;
  const sParams = await searchParams;

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
  let items: Array<{ desc: string; qty: string; unitario: string; total: string; kind?: "producto" | "ajuste" }> = [];
  let totalSoles    = 0;
  let modalidad     = "—";
  let metodo        = "—";
  let entrega       = "—";
  let storedMaderaDocType: "boleta" | "factura" | null = null;
  const queryComprobante =
    (typeof sParams?.tipoComprobante === "string" ? sParams.tipoComprobante : undefined) ||
    (typeof sParams?.comprobante === "string" ? sParams.comprobante : undefined) ||
    (typeof sParams?.tipo_comprobante === "string" ? sParams.tipo_comprobante : undefined);

  // New states for specific types
  let aserraderoServicio: ServicioAserraderoRow | null = null;
  let aserraderoLineasEspeciales: Array<{ id: string; codigo: string; nombre: string; cantidad: number; tarifa: number; subtotal: number }> = [];
  let aserraderoLineasCubicaje: LineaCubicajeAserradero[] = [];

  let ventaMadera: VentaMaderaRow & { lineas: VentaMaderaLineaRow[] } | null = null;
  const ventaMaderaLineasResueltas: Array<{ desc: string; qty: string; unidad: string; unitario: string; total: string }> = [];

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
    clienteDoc    = cli?.ruc ?? cli?.documento ?? "—";

    if (aserraderoServicio.lineas_json) {
      try {
        const parsed = typeof aserraderoServicio.lineas_json === "string" 
          ? JSON.parse(aserraderoServicio.lineas_json) 
          : aserraderoServicio.lineas_json;
        if (Array.isArray(parsed)) {
          aserraderoLineasCubicaje = parsed.filter(esLineaCubicajeAserradero);
          aserraderoLineasEspeciales = parsed.filter(
            (linea) => !esLineaCubicajeAserradero(linea) && linea?.tipo !== "bloque_cubicaje",
          );
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
    clienteDoc    = cli?.ruc ?? cli?.documento ?? "—";

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
    const printModel = buildMaderaCortadaPrintModel(venta, queryComprobante);
    storedMaderaDocType = printModel.tipoComprobante;

    correlativo    = venta.correlativo ?? venta.id.slice(0, 8).toUpperCase();
    fechaVenta     = fmt(venta.fecha);
    totalSoles     = Number(venta.total);
    modalidad      = venta.modalidad_pago ?? "—";
    metodo         = venta.metodo_pago ?? "—";
    entrega        = venta.tipo_entrega ?? "—";

    const cli      = clienteMap.get(venta.cliente_id);
    clienteNombre  = cli?.nombre ?? "—";
    clienteDoc     = cli?.ruc ?? cli?.documento ?? "—";

    items = printModel.items;
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
    clienteDoc    = cli?.ruc ?? cli?.documento ?? "—";

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

  const mostrarCantidadCubicaje = aserraderoLineasCubicaje.some((linea) => linea.cantidad !== 1);
  const totalPTComercialCubicaje = aserraderoLineasCubicaje.reduce(
    (total, linea) => total + getPTComercialLinea(linea),
    0,
  );

  // Fetch advance from movements of cash (caja)
  let montoAdelanto = 0;
  if (modalidad === "adelanto") {
    montoAdelanto = await getAdelantoFromCaja(id);
  }

  // Determine doc type (Factura, Boleta, Nota de Venta)
  let docType = "BOLETA DE VENTA";
  if (storedMaderaDocType === "factura") {
    docType = "FACTURA DE VENTA";
  } else if (storedMaderaDocType === "boleta") {
    docType = "BOLETA DE VENTA";
  } else if (queryComprobante === "factura") {
    docType = "FACTURA DE VENTA";
  } else if (queryComprobante === "boleta") {
    docType = "BOLETA DE VENTA";
  } else if (queryComprobante === "nota_venta") {
    docType = "BOLETA DE VENTA";
  } else {
    // Fallback: check client document
    const isRuc = clienteDoc && clienteDoc.trim().length === 11 && (clienteDoc.trim().startsWith("20") || clienteDoc.trim().startsWith("10"));
    if (isRuc) {
      docType = "FACTURA DE VENTA";
    } else {
      docType = "BOLETA DE VENTA";
    }
  }

  if (tipo === "aserradero" && aserraderoServicio) {
    const model = buildAserraderoPrintModel({
      service: aserraderoServicio,
      customer: clienteMap.get(aserraderoServicio.cliente_id),
      tipoComprobante: docType.includes("FACTURA") ? "factura" : "boleta",
    });
    return (
      <AserraderoPrintA4Detail
        id={id}
        empresa={empresa}
        model={model}
        currentFormat="default"
      />
    );
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
          .aserradero-preview { max-width: 680px !important; }
          .aserradero-cubicacion-table thead { display: table-header-group; }
          .aserradero-cubicacion-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
        body { background: var(--color-bg, #f1f5f9); }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-4 bg-[var(--color-surface,#1e293b)] border-b border-[var(--color-border,#334155)] px-6 py-3 shadow">
        <a href="/ventas" className="text-sm text-[var(--color-text-secondary,#94a3b8)] hover:text-[var(--color-text-primary,#f8fafc)] transition-colors">
          ← Volver
        </a>
        <div className="flex items-center gap-4">
          <PrintSelector
            id={id}
            currentFormat="default"
            docType={docType.includes("BOLETA") ? "boleta" : "factura"}
            tipoSale={tipo}
          />
          <span className="text-xs text-[var(--color-text-secondary,#94a3b8)]">Comprobante #{correlativo}</span>
          <PrintButton />
        </div>
      </div>


      {/* Voucher */}
      <div
        className={`mx-auto px-4 py-6 font-sans text-[13px] sm:p-8 ${
          tipo === "aserradero" ? "aserradero-preview max-w-[1120px]" : "max-w-[680px]"
        }`}
      >
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
            <div className="rounded-xl border-2 border-[var(--color-border,#334155)] px-5 py-3 text-center min-w-[200px]">
              <div className="no-print mb-2 flex justify-center">
                <span className="rounded bg-[var(--color-accent,#3b82f6)] px-2 py-0.5 text-xs font-semibold text-white uppercase tracking-wide">
                  {docType.replace(" DE VENTA", "")}
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary,#64748b)]">
                {docType}
              </p>
              <p className="mt-1 text-lg font-extrabold text-[var(--color-text-primary,#0f172a)]">#{correlativo}</p>
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
              {/* Detalle de madera cubicada */}
              <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
                {aserraderoLineasCubicaje.length > 0 ? (
                  <>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Detalle de madera cubicada</p>
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="aserradero-cubicacion-table w-full min-w-[640px] table-fixed print:min-w-0">
                        <colgroup>
                          <col className="w-[8%]" />
                          {mostrarCantidadCubicaje && <col className="w-[10%]" />}
                          <col className={mostrarCantidadCubicaje ? "w-[18%]" : "w-[20%]"} />
                          <col className={mostrarCantidadCubicaje ? "w-[18%]" : "w-[20%]"} />
                          <col className={mostrarCantidadCubicaje ? "w-[18%]" : "w-[20%]"} />
                          <col className={mostrarCantidadCubicaje ? "w-[28%]" : "w-[32%]"} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] px-2 pb-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">N.º</th>
                            {mostrarCantidadCubicaje && (
                              <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] px-2 pb-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Cantidad</th>
                            )}
                            <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] px-2 pb-1.5 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--color-text-secondary,#64748b)]">Espesor (in)</th>
                            <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] px-2 pb-1.5 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--color-text-secondary,#64748b)]">Ancho (in)</th>
                            <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] px-2 pb-1.5 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--color-text-secondary,#64748b)]">Largo (ft)</th>
                            <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] px-2 pb-1.5 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--color-text-secondary,#64748b)]">Pies tablares (PT)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aserraderoLineasCubicaje.map((linea, index) => (
                            <tr key={linea.id ?? index} className={index % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                              <td className="voucher-td px-2 py-2 text-left text-sm text-[var(--color-text-primary,#1e293b)]">{index + 1}</td>
                              {mostrarCantidadCubicaje && (
                                <td className="voucher-td px-2 py-2 text-right text-sm text-[var(--color-text-primary,#1e293b)]">{linea.cantidad}</td>
                              )}
                              <td className="voucher-td px-2 py-2 text-right text-sm text-[var(--color-text-primary,#1e293b)]">{linea.espesor}</td>
                              <td className="voucher-td px-2 py-2 text-right text-sm text-[var(--color-text-primary,#1e293b)]">{linea.ancho}</td>
                              <td className="voucher-td px-2 py-2 text-right text-sm text-[var(--color-text-primary,#1e293b)]">{linea.largo}</td>
                              <td className="voucher-td px-2 py-2 text-right text-sm font-semibold text-[var(--color-text-primary,#1e293b)]">{getPTComercialLinea(linea)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-[var(--color-border,#e2e8f0)] pt-2 text-sm">
                      <p><strong>TOTAL PIES TABLARES:</strong> {totalPTComercialCubicaje} PT</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Resumen de madera cubicada</p>
                    <div className="grid gap-3 rounded-lg bg-[var(--color-primary-soft,rgba(0,0,0,0.03))] p-3 text-sm sm:grid-cols-2">
                      <p><strong>Volumen calculado:</strong> {aserraderoServicio.pies_cubicos.toFixed(2)} ft³</p>
                      <p className="sm:text-right"><strong>Total calculado:</strong> {(aserraderoServicio.pies_cubicos * 12).toFixed(2)} PT</p>
                    </div>
                  </>
                )}
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
                    {(() => {
                      const lineasEfectivas = aserraderoLineasEspeciales.filter(
                        (linea: any) => linea.tipo !== "nota_interna" && linea.tipo !== "extra_madera_cliente"
                      );
                      
                      return (
                        <>
                          {lineasEfectivas.map((linea, i) => (
                            <tr key={linea.id || i} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                              <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-left">{linea.nombre}</td>
                              <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{linea.cantidad}</td>
                              <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{formatPen(linea.tarifa)}</td>
                              <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right font-semibold">{formatPen(linea.subtotal)}</td>
                            </tr>
                          ))}
                          {lineasEfectivas.length === 0 && (
                            <tr>
                              <td colSpan={4} className="voucher-td py-2 text-sm text-center text-[var(--color-text-secondary,#64748b)]">Ningún servicio especial aplicado.</td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Madera del Cliente (Extras) */}
              {(() => {
                const extrasCliente = aserraderoLineasEspeciales.filter(
                  (linea: any) => linea.tipo === "extra_madera_cliente"
                );
                if (extrasCliente.length === 0) return null;
                return (
                  <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4 bg-slate-50/50">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">
                      Madera del cliente (Adicionales / Extras)
                    </p>
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="voucher-th w-2/3 border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-left">Descripción / Material</th>
                          <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Cant.</th>
                          <th className="voucher-th border-b border-[var(--color-border,#e2e8f0)] pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)] text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extrasCliente.map((linea: any, i) => (
                          <tr key={linea.id || i} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.01))]" : ""}>
                            <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-left">{linea.nombre?.replace("Madera cliente: ", "") || linea.nombre}</td>
                            <td className="voucher-td py-2 text-sm text-[var(--color-text-primary,#1e293b)] text-right">{linea.cantidad}</td>
                            <td className="voucher-td py-2 text-sm text-[var(--color-text-secondary,#94a3b8)] text-right italic font-medium">S/. 0.00 (Propio)</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Total cobrado */}
              <div className="mt-4 flex justify-end">
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
                <table className="w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="voucher-th w-[14%] border-b border-[var(--color-border,#e2e8f0)] pb-2 pl-2 pr-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Cant.</th>
                      <th className="voucher-th w-[50%] border-b border-[var(--color-border,#e2e8f0)] px-2 pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Descripción</th>
                      <th className="voucher-th w-[18%] border-b border-[var(--color-border,#e2e8f0)] px-2 pb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">P. Unit.</th>
                      <th className="voucher-th w-[18%] border-b border-[var(--color-border,#e2e8f0)] pb-2 pl-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventaMaderaLineasResueltas.map((linea, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                        <td className="voucher-td py-2 pl-2 pr-2 text-left text-sm font-semibold text-[var(--color-text-primary,#1e293b)]">
                          <span>{linea.qty}</span>
                          <span className="block text-[10px] font-bold uppercase text-[var(--color-text-secondary,#64748b)]">{linea.unidad}</span>
                        </td>
                        <td className="voucher-td min-w-0 whitespace-normal break-words px-2 py-2 text-left text-sm leading-snug text-[var(--color-text-primary,#1e293b)]">{linea.desc}</td>
                        <td className="voucher-td whitespace-nowrap px-2 py-2 text-right text-sm text-[var(--color-text-primary,#1e293b)]">{linea.unitario}</td>
                        <td className="voucher-td whitespace-nowrap py-2 pl-2 pr-2 text-right text-sm font-semibold text-[var(--color-text-primary,#1e293b)]">{linea.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1.5">
                  <div className="voucher-total-line flex justify-between border-t border-[var(--color-border,#334155)] pt-2 text-base font-bold text-[var(--color-text-primary,#0f172a)]">
                    <span>TOTAL</span>
                    <span>{formatPen(totalSoles)}</span>
                  </div>
                  {modalidad === "adelanto" && (
                    <>
                      <div className="flex justify-between text-xs text-[var(--color-success,#10b981)] font-semibold">
                        <span>ADELANTO (PAGADO)</span>
                        <span>{formatPen(montoAdelanto)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-[var(--color-danger,#ef4444)] font-bold border-t border-dashed border-[var(--color-border,#e2e8f0)] pt-1">
                        <span>SALDO RESTANTE</span>
                        <span>{formatPen(totalSoles - montoAdelanto)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {["madera", "mueble"].includes(tipo) && (
            <>
              {/* Detalle Mueble o Madera Cortada */}
              <div className="voucher-section mt-4 rounded-xl border border-[var(--color-border,#e2e8f0)] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Detalle</p>
                <table className="w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="voucher-th w-[14%] border-b border-[var(--color-border,#e2e8f0)] pb-2 pl-2 pr-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Cant.</th>
                      <th className="voucher-th w-[50%] border-b border-[var(--color-border,#e2e8f0)] px-2 pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Descripción</th>
                      <th className="voucher-th w-[18%] border-b border-[var(--color-border,#e2e8f0)] px-2 pb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">P. Unit.</th>
                      <th className="voucher-th w-[18%] border-b border-[var(--color-border,#e2e8f0)] pb-2 pl-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary,#64748b)]">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-[var(--color-primary-soft,rgba(0,0,0,0.03))]" : ""}>
                        <td className="voucher-td whitespace-normal py-2 pl-2 pr-2 text-left text-sm font-semibold text-[var(--color-text-primary,#1e293b)]">
                          {tipo === "mueble" ? `${item.qty} UND.` : item.qty}
                        </td>
                        <td className="voucher-td min-w-0 whitespace-normal break-words px-2 py-2 text-sm leading-snug text-[var(--color-text-primary,#1e293b)]">{item.desc}</td>
                        <td className="voucher-td whitespace-nowrap px-2 py-2 text-right text-sm text-[var(--color-text-primary,#1e293b)]">{item.unitario}</td>
                        <td className="voucher-td whitespace-nowrap py-2 pl-2 pr-2 text-right text-sm font-semibold text-[var(--color-text-primary,#1e293b)]">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1.5">
                  <div className="voucher-total-line flex justify-between border-t border-[var(--color-border,#334155)] pt-2 text-base font-bold text-[var(--color-text-primary,#0f172a)]">
                    <span>TOTAL</span>
                    <span>{formatPen(totalSoles)}</span>
                  </div>
                  {modalidad === "adelanto" && (
                    <>
                      <div className="flex justify-between text-xs text-[var(--color-success,#10b981)] font-semibold">
                        <span>ADELANTO (PAGADO)</span>
                        <span>{formatPen(montoAdelanto)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-[var(--color-danger,#ef4444)] font-bold border-t border-dashed border-[var(--color-border,#e2e8f0)] pt-1">
                        <span>SALDO RESTANTE</span>
                        <span>{formatPen(totalSoles - montoAdelanto)}</span>
                      </div>
                    </>
                  )}
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
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <DecorativeQr className="h-16 w-16" />
            <p className="text-[10px] font-medium text-[var(--color-text-secondary,#64748b)]">
              Documento interno de venta. No válido como comprobante SUNAT.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
