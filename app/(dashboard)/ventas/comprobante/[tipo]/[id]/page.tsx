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

async function getMaderaCortadaById(id: string): Promise<MaderaCortadaRow | null> {
  if (!hasSupabaseEnv()) return null;
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

// ── Styles ────────────────────────────────────────────────────────────────────

const containerCls = "mx-auto max-w-[680px] p-8 font-sans text-[13px] text-slate-900";
const sectionCls = "mt-6 rounded-xl border border-slate-200 p-4";
const labelCls = "text-[10px] font-semibold uppercase tracking-wide text-slate-400";
const valueCls = "mt-0.5 text-sm font-medium text-slate-800";
const thCls = "border-b border-slate-200 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-left";
const tdCls = "py-2 text-sm text-slate-800";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComprobantePage({ params }: { params: Promise<Params> }) {
  const { tipo, id } = await params;

  if (!["madera", "mueble"].includes(tipo)) notFound();

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

  if (tipo === "madera") {
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

  const igv  = totalSoles * 0.18;
  const base = totalSoles - igv;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 14mm; }
        }
        body { background: #f1f5f9; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-4 bg-slate-800 px-6 py-3 shadow">
        <a href="javascript:history.back()" className="text-sm text-slate-300 hover:text-white">
          ← Volver
        </a>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Comprobante #{correlativo}</span>
          <PrintButton />
        </div>
      </div>

      {/* Voucher */}
      <div className={containerCls}>
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
            <p className="text-base font-bold uppercase tracking-wide text-slate-800">{empresa.nombre}</p>
            <p className="text-[11px] text-slate-500">RUC: {empresa.ruc}</p>
            {empresa.direccion ? <p className="text-[11px] text-slate-500">{empresa.direccion}</p> : null}
            {empresa.telefono ? <p className="text-[11px] text-slate-500">Tel: {empresa.telefono}</p> : null}
          </div>

          {/* Voucher box */}
          <div className="rounded-xl border-2 border-slate-700 px-5 py-3 text-center">
            <div className="no-print mb-2 flex gap-2">
              <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white">BOLETA</span>
              <span className="rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600">FACTURA</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">COMPROBANTE DE VENTA</p>
            <p className="mt-1 text-lg font-bold text-slate-800">#{correlativo}</p>
            <p className="mt-0.5 text-xs text-slate-500">{fechaVenta}</p>
          </div>
        </div>

        {/* Client */}
        <div className={sectionCls}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Datos del cliente</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Nombre / Razón social</p>
              <p className={valueCls}>{clienteNombre}</p>
            </div>
            <div>
              <p className={labelCls}>DNI / RUC</p>
              <p className={valueCls}>{clienteDoc}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className={sectionCls}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Detalle</p>
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${thCls} w-1/2`}>Descripción</th>
                <th className={`${thCls} text-right`}>Cant.</th>
                <th className={`${thCls} text-right`}>Precio unit.</th>
                <th className={`${thCls} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                  <td className={tdCls}>{item.desc}</td>
                  <td className={`${tdCls} text-right`}>{item.qty}</td>
                  <td className={`${tdCls} text-right`}>{item.unitario}</td>
                  <td className={`${tdCls} text-right font-semibold`}>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Valor de venta</span>
              <span>{formatPen(base)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>IGV (18%)</span>
              <span>{formatPen(igv)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-slate-700 pt-1.5 text-base font-bold text-slate-900">
              <span>TOTAL</span>
              <span>{formatPen(totalSoles)}</span>
            </div>
          </div>
        </div>

        {/* Payment + delivery */}
        <div className={`${sectionCls} grid grid-cols-3 gap-4`}>
          <div>
            <p className={labelCls}>Modalidad de pago</p>
            <p className={`${valueCls} capitalize`}>{modalidad}</p>
          </div>
          <div>
            <p className={labelCls}>Método de pago</p>
            <p className={`${valueCls} capitalize`}>{metodo}</p>
          </div>
          <div>
            <p className={labelCls}>Entrega</p>
            <p className={`${valueCls} capitalize`}>{entrega}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-end justify-between gap-4 border-t border-slate-200 pt-6">
          <p className="text-[10px] text-slate-400">
            Documento generado por Katia Suite · {empresa.nombre}
          </p>
          <div className="text-center">
            <div className="mb-1 h-px w-48 bg-slate-400" />
            <p className="text-[11px] text-slate-500">{empresa.firmante}</p>
            <p className="text-[10px] text-slate-400">Firma autorizada</p>
          </div>
        </div>
      </div>
    </>
  );
}
