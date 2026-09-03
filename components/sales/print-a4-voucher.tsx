import { notFound } from "next/navigation";
import Image from "next/image";
import { getEmpresaConfig } from "@/lib/company-config";
import { getClientesRows, getChoferesRows } from "@/lib/data";
import { formatPen } from "@/lib/utils";
import { resolveSaleDocument, getProductoMaderaById, getAdelantoFromCaja, getMuebleNombre } from "@/lib/print-helpers";
import { PrintButton } from "@/components/ui/print-button";
import { PrintSelector } from "@/components/ui/print-selector";
import { buildAserraderoPrintModel } from "@/lib/aserradero-print-model";
import { AserraderoPrintA4Detail } from "@/components/sales/aserradero-print-a4-detail";
import {
  buildMaderaCortadaPrintModel,
  getMaderaCortadaCustomerItems,
} from "@/lib/madera-cortada-print-model";

type PrintA4VoucherProps = {
  id: string;
  docType: "boleta" | "factura";
  searchTipo?: string;
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
      className={`grid shrink-0 rounded-md border border-gray-300 bg-white p-1 ${className}`}
      style={{ gridTemplateColumns: "repeat(9, minmax(0, 1fr))" }}
      aria-label="QR decorativo"
    >
      {decorativeQrCells.map((cell, index) => (
        <span key={index} className={cell ? "aspect-square bg-gray-900" : "aspect-square bg-white"} />
      ))}
    </div>
  );
}
export async function PrintA4Voucher({ id, docType, searchTipo }: PrintA4VoucherProps) {
  const { tipo, data: saleRecord } = await resolveSaleDocument(id, searchTipo);
  if (!saleRecord) {
    notFound();
  }

  const [empresa, clientes, choferes] = await Promise.all([
    getEmpresaConfig(),
    getClientesRows(),
    getChoferesRows(),
  ]);

  const clienteMap = new Map(clientes.map((c) => [c.id, c]));
  const choferMap  = new Map(choferes.map((c) => [c.id, c.nombre]));

  if (tipo === "aserradero") {
    const customer = clienteMap.get(saleRecord.cliente_id);
    const model = buildAserraderoPrintModel({
      service: saleRecord,
      customer,
      tipoComprobante: docType,
    });
    return (
      <AserraderoPrintA4Detail
        id={id}
        empresa={empresa}
        model={model}
        currentFormat="a4"
      />
    );
  }

  let correlativo = "—";
  let fechaVenta  = "—";
  let clienteNombre = "—";
  let clienteDoc    = "—";
  let items: Array<{ desc: string; qty: string; unitario: string; total: string; kind?: "producto" | "ajuste" }> = [];
  let totalSoles    = 0;
  let modalidad     = "—";
  let metodo        = "—";
  let entrega       = "—";
  let effectiveDocType: "boleta" | "factura" = docType;

  let aserraderoServicio: any = null;
  let aserraderoLineasEspeciales: Array<{ id: string; codigo: string; nombre: string; cantidad: number; tarifa: number; subtotal: number; tipo?: string }> = [];
  let aserraderoLineasCubicaje: LineaCubicajeAserradero[] = [];
  const ventaMaderaLineasResueltas: Array<{ desc: string; qty: string; unidad: string; unitario: string; total: string }> = [];

  if (tipo === "aserradero") {
    aserraderoServicio = saleRecord;
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
    const ventaMadera = saleRecord;
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
    const venta = saleRecord;
    const printModel = buildMaderaCortadaPrintModel(venta, docType);
    effectiveDocType = printModel.tipoComprobante;
    correlativo    = venta.correlativo ?? venta.id.slice(0, 8).toUpperCase();
    fechaVenta     = fmt(venta.fecha);
    totalSoles     = Number(venta.total);
    modalidad      = venta.modalidad_pago ?? "—";
    metodo         = venta.metodo_pago ?? "—";
    entrega        = venta.tipo_entrega ?? "—";

    const cli      = clienteMap.get(venta.cliente_id);
    clienteNombre  = cli?.nombre ?? "—";
    clienteDoc     = cli?.ruc ?? cli?.documento ?? "—";

    items = getMaderaCortadaCustomerItems(printModel.items, printModel.totalSoles);
    if (venta.tipo_entrega && venta.tipo_entrega !== "recojo" && venta.direccion_entrega) {
      entrega = `${venta.tipo_entrega} — ${venta.direccion_entrega}`;
    }
  } else {
    const venta = saleRecord;
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

  let montoAdelanto = 0;
  if (modalidad === "adelanto") {
    montoAdelanto = await getAdelantoFromCaja(id);
  }

  const docTitle = effectiveDocType === "factura" ? "FACTURA DE VENTA" : "BOLETA DE VENTA";
  const brandContactLines = [
    empresa.telefono ? `Tel: ${empresa.telefono}` : null,
    empresa.direccion ? `Dir: ${empresa.direccion}` : null,
    empresa.ruc ? `RUC: ${empresa.ruc}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: #000 !important; font-family: 'Inter', BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
          @page {
            size: A4;
            margin: 10mm;
          }
          .a4-print-container {
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
        body { background: #f8fafc; color: #0f172a; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-4 bg-[#1e293b] border-b border-[#334155] px-6 py-3 shadow">
        <a href="/ventas" className="text-sm text-[#94a3b8] hover:text-white transition-colors">
          ← Volver
        </a>
        <div className="flex items-center gap-4">
          <PrintSelector
            id={id}
            currentFormat="a4"
            docType={effectiveDocType}
            tipoSale={tipo}
          />
          <PrintButton />
        </div>
      </div>

      {/* Document page layout A4 */}
      <div
        className={`a4-print-container mx-auto my-6 rounded-2xl border border-[#e2e8f0] bg-white p-10 text-black shadow-lg ${
          tipo === "aserradero" ? "w-full max-w-[1120px]" : "max-w-4xl"
        }`}
      >
        
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-6">
          <div className="flex-1">
            {empresa.logo_url ? (
              <Image
                src={empresa.logo_url}
                alt={empresa.nombre}
                width={160}
                height={64}
                className="mb-3 object-contain"
                unoptimized
              />
            ) : null}
            <h1 className="text-xl font-black uppercase tracking-wider">{empresa.nombre}</h1>
            <p className="text-xs text-gray-600 mt-1"><strong>RUC:</strong> {empresa.ruc}</p>
            {empresa.direccion && <p className="text-xs text-gray-600"><strong>Dir:</strong> {empresa.direccion}</p>}
            {empresa.telefono && <p className="text-xs text-gray-600"><strong>Tel:</strong> {empresa.telefono}</p>}
          </div>

          <div className="rounded-xl border-2 border-black p-5 text-center min-w-[240px] bg-slate-50">
            <h2 className="text-base font-extrabold uppercase tracking-widest text-gray-700">{docTitle}</h2>
            <p className="mt-2 text-2xl font-black text-black">N° {correlativo}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">{fechaVenta}</p>
          </div>
        </div>

        {/* Customer Data */}
        <div className="mt-6 rounded-xl border border-gray-300 p-4 bg-slate-50/50">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-600 mb-3">Datos del Cliente</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Nombre / Razón Social</span>
              <p className="text-sm font-semibold mt-0.5">{clienteNombre}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Documento (DNI / RUC)</span>
              <p className="text-sm font-semibold mt-0.5">{clienteDoc}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Detail rendering based on tipo */}
        {tipo === "aserradero" && aserraderoServicio && (
          <div className="mt-6 space-y-6">
            {/* Detalle de madera cubicada */}
            <div className="rounded-xl border border-gray-300 p-4">
              {aserraderoLineasCubicaje.length > 0 ? (
                <>
                  <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-600">Detalle de madera cubicada</h3>
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full min-w-[640px] table-fixed text-xs print:min-w-0">
                      <colgroup>
                        <col className="w-[8%]" />
                        {mostrarCantidadCubicaje && <col className="w-[10%]" />}
                        <col className={mostrarCantidadCubicaje ? "w-[18%]" : "w-[20%]"} />
                        <col className={mostrarCantidadCubicaje ? "w-[18%]" : "w-[20%]"} />
                        <col className={mostrarCantidadCubicaje ? "w-[18%]" : "w-[20%]"} />
                        <col className={mostrarCantidadCubicaje ? "w-[28%]" : "w-[32%]"} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-400 bg-slate-100">
                          <th className="px-2 py-2 text-left font-bold uppercase">N.º</th>
                          {mostrarCantidadCubicaje && (
                            <th className="px-2 py-2 text-right font-bold uppercase">Cantidad</th>
                          )}
                          <th className="px-2 py-2 text-right font-bold uppercase leading-tight">Espesor (in)</th>
                          <th className="px-2 py-2 text-right font-bold uppercase leading-tight">Ancho (in)</th>
                          <th className="px-2 py-2 text-right font-bold uppercase leading-tight">Largo (ft)</th>
                          <th className="px-2 py-2 text-right font-bold uppercase leading-tight">Pies tablares (PT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aserraderoLineasCubicaje.map((linea, index) => (
                          <tr key={linea.id ?? index} className="border-b border-gray-200">
                            <td className="px-2 py-2 text-left text-sm">{index + 1}</td>
                            {mostrarCantidadCubicaje && (
                              <td className="px-2 py-2 text-right text-sm">{linea.cantidad}</td>
                            )}
                            <td className="px-2 py-2 text-right text-sm">{linea.espesor}</td>
                            <td className="px-2 py-2 text-right text-sm">{linea.ancho}</td>
                            <td className="px-2 py-2 text-right text-sm">{linea.largo}</td>
                            <td className="px-2 py-2 text-right text-sm font-bold">{getPTComercialLinea(linea)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex justify-end border-t border-gray-300 pt-2 text-sm">
                    <p><strong>TOTAL PIES TABLARES:</strong> {totalPTComercialCubicaje} PT</p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-600">Resumen de madera cubicada</h3>
                  <div className="grid gap-3 rounded-lg bg-slate-100 p-3 text-sm sm:grid-cols-2">
                    <p><strong>Volumen calculado:</strong> {aserraderoServicio.pies_cubicos.toFixed(2)} ft³</p>
                    <p className="sm:text-right"><strong>Total calculado:</strong> {(aserraderoServicio.pies_cubicos * 12).toFixed(2)} PT</p>
                  </div>
                </>
              )}
            </div>

            {/* Servicios Especiales */}
            <div className="rounded-xl border border-gray-300 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-600 mb-3">Servicios Especiales Aplicados</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-400 bg-slate-100">
                    <th className="text-left py-2 font-bold uppercase">Servicio</th>
                    <th className="text-right py-2 font-bold uppercase">Cantidad</th>
                    <th className="text-right py-2 font-bold uppercase">Tarifa</th>
                    <th className="text-right py-2 font-bold uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const lineasEfectivas = aserraderoLineasEspeciales.filter(
                      (linea) => linea.tipo !== "nota_interna" && linea.tipo !== "extra_madera_cliente"
                    );
                    if (lineasEfectivas.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-gray-500 italic">Ningún servicio especial aplicado.</td>
                        </tr>
                      );
                    }
                    return lineasEfectivas.map((linea, i) => (
                      <tr key={linea.id || i} className="border-b border-gray-200">
                        <td className="py-2.5 text-sm">{linea.nombre}</td>
                        <td className="text-right py-2.5 text-sm">{linea.cantidad}</td>
                        <td className="text-right py-2.5 text-sm">{formatPen(linea.tarifa)}</td>
                        <td className="text-right py-2.5 text-sm font-bold">{formatPen(linea.subtotal)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Extras */}
            {(() => {
              const extrasCliente = aserraderoLineasEspeciales.filter(
                (linea) => linea.tipo === "extra_madera_cliente"
              );
              if (extrasCliente.length === 0) return null;
              return (
                <div className="rounded-xl border border-gray-300 p-4 bg-slate-50">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-600 mb-3">Madera Propia de Cliente (Extras)</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-400 bg-slate-200">
                        <th className="text-left py-2 font-bold uppercase">Descripción / Tipo de Madera</th>
                        <th className="text-right py-2 font-bold uppercase">Cantidad</th>
                        <th className="text-right py-2 font-bold uppercase">Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extrasCliente.map((linea, i) => (
                        <tr key={linea.id || i} className="border-b border-gray-200">
                          <td className="py-2.5 text-sm">{linea.nombre?.replace("Madera cliente: ", "") || linea.nombre}</td>
                          <td className="text-right py-2.5 text-sm">{linea.cantidad}</td>
                          <td className="text-right py-2.5 text-sm text-gray-500 italic">Propio (S/ 0.00)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Total cobrado */}
            <div className="mt-6 flex justify-end border-t border-gray-300 pt-4">
              <div className="w-80 rounded-xl border border-black p-4 bg-slate-50 text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Monto Total Cobrado</span>
                <p className="text-2xl font-black text-black mt-1">{formatPen(totalSoles)}</p>
              </div>
            </div>
          </div>
        )}

        {tipo === "venta-madera" && (
          <div className="mt-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-600 mb-3">Detalle de Productos</h3>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[50%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-300 bg-slate-50">
                  <th className="py-2 pl-3 pr-2 text-left font-bold uppercase tracking-wide">Cant.</th>
                  <th className="px-2 py-2 text-left font-bold uppercase tracking-wide">Descripción</th>
                  <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">P. Unit.</th>
                  <th className="py-2 pl-2 pr-3 text-right font-bold uppercase tracking-wide">Importe</th>
                </tr>
              </thead>
              <tbody>
                {ventaMaderaLineasResueltas.map((linea, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2.5 pl-3 pr-2 text-left text-sm font-semibold">
                      <span>{linea.qty}</span>
                      <span className="block text-[10px] font-bold uppercase text-gray-500">{linea.unidad}</span>
                    </td>
                    <td className="min-w-0 whitespace-normal break-words px-2 py-2.5 text-sm font-semibold leading-snug">{linea.desc}</td>
                    <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap">{linea.unitario}</td>
                    <td className="py-2.5 pl-2 pr-3 text-right text-sm font-bold whitespace-nowrap">{linea.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totales */}
            <div className="mt-6 flex justify-end">
              <div className="w-80 rounded-xl border border-black p-4 bg-slate-50 text-right space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500">Monto Total:</span>
                  <span className="text-lg font-black">{formatPen(totalSoles)}</span>
                </div>
                {modalidad === "adelanto" && (
                  <>
                    <div className="flex justify-between items-center text-emerald-600 border-t border-dashed border-gray-300 pt-2">
                      <span className="text-xs font-bold">Adelanto (Pagado):</span>
                      <span className="text-sm font-bold">{formatPen(montoAdelanto)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600 border-t border-gray-300 pt-2">
                      <span className="text-xs font-bold">Saldo Pendiente:</span>
                      <span className="text-base font-black">{formatPen(totalSoles - montoAdelanto)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {["madera", "mueble"].includes(tipo || "") && (
          <div className="mt-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-600 mb-3">Detalle de Venta</h3>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[50%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-300 bg-slate-50">
                  <th className="py-2 pl-3 pr-2 text-left font-bold uppercase tracking-wide">Cant.</th>
                  <th className="px-2 py-2 text-left font-bold uppercase tracking-wide">Descripción</th>
                  <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">P. Unit.</th>
                  <th className="py-2 pl-2 pr-3 text-right font-bold uppercase tracking-wide">Importe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2.5 pl-3 pr-2 text-left text-sm font-semibold whitespace-normal">
                      {tipo === "mueble" ? `${item.qty} UND.` : item.qty}
                    </td>
                    <td className="min-w-0 whitespace-normal break-words px-2 py-2.5 text-sm leading-snug">
                      <p className="font-semibold">{item.desc}</p>
                    </td>
                    <td className="px-2 py-2.5 text-right text-sm whitespace-nowrap">{item.unitario}</td>
                    <td className="py-2.5 pl-2 pr-3 text-right text-sm font-bold whitespace-nowrap">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totales */}
            <div className="mt-6 flex justify-end">
              <div className="w-80 rounded-xl border border-black p-4 bg-slate-50 text-right space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500">Monto Total:</span>
                  <span className="text-lg font-black">{formatPen(totalSoles)}</span>
                </div>
                {modalidad === "adelanto" && (
                  <>
                    <div className="flex justify-between items-center text-emerald-600 border-t border-dashed border-gray-300 pt-2">
                      <span className="text-xs font-bold">Adelanto (Pagado):</span>
                      <span className="text-sm font-bold">{formatPen(montoAdelanto)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600 border-t border-gray-300 pt-2">
                      <span className="text-xs font-bold">Saldo Pendiente:</span>
                      <span className="text-base font-black">{formatPen(totalSoles - montoAdelanto)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Extra details (Payment/Delivery method) */}
        <div className="mt-8 grid grid-cols-3 gap-6 border-t border-gray-300 pt-6 text-xs">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Modalidad de Pago</span>
            <p className="text-sm font-semibold mt-1 capitalize">{modalidad}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Método de Pago</span>
            <p className="text-sm font-semibold mt-1 capitalize">{metodo}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Tipo de Entrega</span>
            <p className="text-sm font-semibold mt-1 capitalize">{entrega}</p>
          </div>
        </div>

        {/* Corporate Signatures */}
        <div className="mt-16 grid grid-cols-2 gap-12 text-center text-xs">
          <div className="flex flex-col items-center">
            <div className="w-48 border-b border-gray-400 h-16 mb-2"></div>
            <p className="font-bold uppercase">{clienteNombre}</p>
            <p className="text-gray-500">Cliente</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-48 border-b border-gray-400 h-16 mb-2"></div>
            <p className="font-bold uppercase">Katia Lizzet Meneses Taype</p>
            <p className="text-gray-500">Gerente</p>
          </div>
        </div>
        {/* Brand footer */}
        <div className="mt-8 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-slate-50/70 px-4 py-3 text-xs text-gray-600">
            <div className="flex min-w-0 items-center gap-3">
              {empresa.logo_url ? (
                <Image
                  src={empresa.logo_url}
                  alt={empresa.nombre}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md border border-gray-200 bg-white object-contain p-1"
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-black text-gray-700">
                  {empresa.nombre.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-wide text-gray-800">{empresa.nombre}</p>
                <p className="font-semibold text-gray-700">Gracias por su compra</p>
                <p className="mt-0.5 text-[10px] font-medium text-gray-500">Documento interno de venta. No válido como comprobante SUNAT.</p>
                {brandContactLines.length > 0 ? (
                  <p className="mt-0.5 whitespace-normal break-words leading-snug text-gray-500">
                    {brandContactLines.join(" | ")}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <DecorativeQr className="h-16 w-16" />
              <p className="text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Comprobante A4
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
