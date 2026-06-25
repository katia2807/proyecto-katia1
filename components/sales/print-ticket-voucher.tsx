import { notFound } from "next/navigation";
import { getEmpresaConfig } from "@/lib/company-config";
import { getClientesRows } from "@/lib/data";
import { formatPen } from "@/lib/utils";
import { resolveSaleDocument, getProductoMaderaById, getAdelantoFromCaja, getMuebleNombre } from "@/lib/print-helpers";
import { PrintButton } from "@/components/ui/print-button";
import { PrintSelector } from "@/components/ui/print-selector";

type PrintTicketVoucherProps = {
  id: string;
  docType: "boleta" | "factura";
  searchTipo?: string;
};

function fmt(date: string) {
  try {
    return new Date(date).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return date;
  }
}

export async function PrintTicketVoucher({ id, docType, searchTipo }: PrintTicketVoucherProps) {
  const { tipo, data: saleRecord } = await resolveSaleDocument(id, searchTipo);
  if (!saleRecord) {
    notFound();
  }

  const [empresa, clientes] = await Promise.all([
    getEmpresaConfig(),
    getClientesRows(),
  ]);

  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  let correlativo = "—";
  let fechaVenta  = "—";
  let clienteNombre = "—";
  let clienteDoc    = "—";
  let items: Array<{ desc: string; qty: string; unitario: string; total: string }> = [];
  let totalSoles    = 0;
  let modalidad     = "—";
  let metodo        = "—";
  let entrega       = "—";

  let aserraderoServicio: any = null;
  let aserraderoLineasEspeciales: Array<{ id: string; codigo: string; nombre: string; cantidad: number; tarifa: number; subtotal: number; tipo?: string }> = [];
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
          aserraderoLineasEspeciales = parsed;
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
    correlativo    = venta.correlativo ?? venta.id.slice(0, 8).toUpperCase();
    fechaVenta     = fmt(venta.fecha);
    totalSoles     = Number(venta.total);
    modalidad      = venta.modalidad_pago ?? "—";
    metodo         = venta.metodo_pago ?? "—";
    entrega        = venta.tipo_entrega ?? "—";

    const cli      = clienteMap.get(venta.cliente_id);
    clienteNombre  = cli?.nombre ?? "—";
    clienteDoc     = cli?.ruc ?? cli?.documento ?? "—";

    const cantidadPiezas = Number(venta.cantidad_piezas ?? 0);
    const precioUnitarioComercial = Number(venta.precio_unitario_comercial ?? 0);
    const usarPrecioComercial = cantidadPiezas > 0 && precioUnitarioComercial > 0;
    const pt       = Number(venta.total_pt ?? 0).toFixed(2);
    const ppt      = Number(venta.precio_por_pt ?? 0);
    const tipoCorte = (venta.tipo_corte ?? "madera").replace(/_/g, " ");
    items = [
      {
        desc: `Madera cortada - ${tipoCorte}`,
        qty: usarPrecioComercial ? `${cantidadPiezas} pzs` : `${pt} PT`,
        unitario: usarPrecioComercial ? formatPen(precioUnitarioComercial) : formatPen(ppt),
        total: formatPen(totalSoles),
      },
    ];
    if (venta.costo_envio && Number(venta.costo_envio) > 0) {
      items.push({
        desc: "Envio",
        qty: "1",
        unitario: formatPen(Number(venta.costo_envio)),
        total: formatPen(Number(venta.costo_envio)),
      });
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

  let montoAdelanto = 0;
  if (modalidad === "adelanto") {
    montoAdelanto = await getAdelantoFromCaja(id);
  }

  const docTitle = docType === "factura" ? "FACTURA DE VENTA" : "BOLETA DE VENTA";

  return (
    <>
      <style>{`
        /* 
          CALIBRACIÓN DE IMPRESIÓN TÉRMICA (POS-80C)
          ------------------------------------------
          Ancho del papel de la ticketera: 80mm
          Ancho útil de impresión recomendado: 72mm (para evitar cortes en los bordes)
          Margen mínimo seguro: 0mm a 2mm
        */

        .ticket-container {
          width: 72mm !important; /* Calibrable: Ancho útil óptimo para POS-80C */
          max-width: 72mm !important;
          padding: 2mm 1mm 4mm 1mm !important; /* Margen interno seguro */
          margin: 0 auto !important;
          background: white !important;
          color: black !important;
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 11px !important; /* Calibrable: Tamaño de letra base óptimo para ticket */
          line-height: 1.25 !important; /* Espaciado compacto para evitar consumo excesivo de papel */
          box-shadow: none !important;
          border: none !important;
        }

        .ticket-title {
          font-size: 14px !important; /* Calibrable: Título principal de la empresa */
          font-weight: bold !important;
          text-align: center !important;
        }

        .ticket-subtitle {
          font-size: 11px !important; /* Subtítulos e info adicional */
          text-align: center !important;
        }

        .ticket-total {
          font-size: 13px !important; /* Calibrable: Tamaño destacado para el total */
          font-weight: bold !important;
        }

        .ticket-table {
          width: 100% !important;
          border-collapse: collapse !important;
        }

        .ticket-table td,
        .ticket-table th {
          font-size: 11px !important; /* Calibrable: Tamaño para items de la tabla */
          padding: 3px 0 !important;
          vertical-align: top !important;
        }

        .ticket-dashed-line {
          border-top: 1px dashed black !important;
          margin: 4px 0 !important;
          height: 0px !important;
          display: block !important;
        }

        .ticket-flex-row {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          width: 100% !important;
        }

        @media print {
          .no-print { 
            display: none !important; 
          }
          
          html,
          body {
            width: 80mm !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important; /* Permite que el ticket crezca naturalmente sin recortarse */
          }

          @page {
            size: 80mm; /* Máxima compatibilidad para indicar ancho de rollo en Windows/Chrome */
            margin: 0mm !important; /* Margen de página cero para controlar el margen desde el contenedor */
          }

          body * {
            visibility: hidden;
          }

          .ticket-container,
          .ticket-container * {
            visibility: visible;
          }

          .ticket-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm !important; /* Ancho útil real calibrado para la POS-80C */
            max-width: 72mm !important;
            min-height: auto !important;
            height: auto !important;
            margin: 0 !important;
            padding: 2mm 1mm 4mm 1mm !important;
          }
        }
        
        /* Screen View Styles only */
        @media screen {
          body {
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            min-height: 100vh;
            font-family: Arial, Helvetica, sans-serif;
            padding-bottom: 2rem;
          }

          .ticket-container {
            margin-top: 2rem !important;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.5) !important;
            border-radius: 6px !important;
            border: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print w-full sticky top-0 z-50 flex items-center justify-between gap-4 bg-[#1e293b] border-b border-[#334155] px-6 py-3 shadow">
        <a href="/ventas" className="text-sm text-[#94a3b8] hover:text-white transition-colors">
          ← Volver
        </a>
        <div className="flex items-center gap-4">
          <PrintSelector
            id={id}
            currentFormat="ticket"
            docType={docType}
            tipoSale={tipo}
          />
          <PrintButton />
        </div>
      </div>

      {/* 80mm Thermal Ticket Design */}
      <div className="ticket-container">
        
        {/* Header (Company info) */}
        <div className="text-center space-y-1">
          <p className="ticket-title uppercase">{empresa.nombre}</p>
          <p className="ticket-subtitle">RUC: {empresa.ruc}</p>
          {empresa.direccion && <p className="text-center text-[10px]">{empresa.direccion}</p>}
          {empresa.telefono && <p className="text-center text-[10px]">TEL: {empresa.telefono}</p>}
          <div className="ticket-dashed-line"></div>
        </div>

        {/* Document type + number */}
        <div className="text-center font-bold my-1 text-xs">
          <p className="tracking-wide">{docTitle}</p>
          <p>N° {correlativo}</p>
        </div>
        <div className="ticket-dashed-line"></div>

        {/* Date & Customer Info */}
        <div className="space-y-0.5 text-[10px]">
          <p><strong>FECHA:</strong> {fechaVenta}</p>
          <p><strong>ADQUIRIENTE:</strong> {clienteNombre}</p>
          <p><strong>DOC ID:</strong> {clienteDoc}</p>
          <p><strong>VENDEDOR:</strong> Katia Lizzet M.</p>
        </div>
        <p className="border-b border-black my-1.5"></p>

        {/* Items Table */}
        <div>
          <table className="ticket-table">
            <thead>
              <tr className="border-b border-dashed border-black font-bold">
                <th className="text-left" style={{ width: "50%" }}>CANT/DESCRIPCION</th>
                <th className="text-right" style={{ width: "22%" }}>P.UNIT</th>
                <th className="text-right" style={{ width: "28%" }}>IMPORTE</th>
              </tr>
            </thead>
            <tbody>
              {/* Dynamic Items */}
              {tipo === "aserradero" && aserraderoServicio && (
                <>
                  <tr className="border-b border-dashed border-gray-200">
                    <td className="py-1 font-semibold text-left">1 x Aserradero base ({Number(aserraderoServicio.pies_cubicos).toFixed(2)} ft³)</td>
                    <td className="text-right">—</td>
                    <td className="text-right">{formatPen(Number(aserraderoServicio.costo_cubicaje))}</td>
                  </tr>

                  {aserraderoLineasEspeciales
                    .filter((l) => l.tipo !== "nota_interna" && l.tipo !== "extra_madera_cliente")
                    .map((linea, idx) => (
                      <tr key={idx} className="border-b border-dashed border-gray-200">
                        <td className="py-1 font-semibold text-left">{linea.cantidad} x {linea.nombre}</td>
                        <td className="text-right">{formatPen(linea.tarifa)}</td>
                        <td className="text-right">{formatPen(linea.subtotal)}</td>
                      </tr>
                    ))}
                </>
              )}

              {tipo === "venta-madera" && ventaMaderaLineasResueltas.map((linea, idx) => (
                <tr key={idx} className="border-b border-dashed border-gray-200">
                  <td className="py-1 font-semibold text-left">{linea.qty} {linea.unidad} x {linea.desc}</td>
                  <td className="text-right">{linea.unitario}</td>
                  <td className="text-right">{linea.total}</td>
                </tr>
              ))}

              {["madera", "mueble"].includes(tipo || "") && items.map((item, idx) => (
                <tr key={idx} className="border-b border-dashed border-gray-200">
                  <td className="py-1 font-semibold text-left">{item.qty} x {item.desc}</td>
                  <td className="text-right">{item.unitario}</td>
                  <td className="text-right">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-b border-black my-1.5"></p>

        {/* Financial Breakdown / Totals */}
        <div className="space-y-1 text-right font-bold">
          <div className="ticket-flex-row ticket-total">
            <span>TOTAL A PAGAR:</span>
            <span>{formatPen(totalSoles)}</span>
          </div>

          {modalidad === "adelanto" && (
            <>
              <div className="ticket-flex-row text-[10px] text-emerald-800">
                <span>ANTICIPO PAGADO:</span>
                <span>{formatPen(montoAdelanto)}</span>
              </div>
              <div className="ticket-flex-row text-[11px] text-red-800 border-t border-dashed border-black pt-1">
                <span>SALDO RESTANTE:</span>
                <span>{formatPen(totalSoles - montoAdelanto)}</span>
              </div>
            </>
          )}
        </div>
        <div className="ticket-dashed-line"></div>

        {/* Metadata */}
        <div className="text-[10px] space-y-0.5">
          <p><strong>MODALIDAD:</strong> {modalidad}</p>
          <p><strong>METODO PAGO:</strong> {metodo}</p>
          <p><strong>ENTREGA:</strong> {entrega}</p>
        </div>
        <div className="ticket-dashed-line"></div>

        {/* Bottom barcode mockup and feedback */}
        <div className="flex flex-col items-center justify-center space-y-1 mt-3 text-center">
          {/* Simulated QR block */}
          <div className="w-20 h-20 border border-black flex flex-col items-center justify-center p-1 bg-white">
            <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white text-[7px]">
              [ QR SUNAT ]
            </div>
          </div>
          <p className="text-[8px] mt-1.5 font-bold">Representación impresa autorizada de comprobante electrónico.</p>
          <p className="text-[10px] font-bold tracking-wider mt-1 text-center">¡GRACIAS POR SU PREFERENCIA!</p>
        </div>

      </div>
    </>
  );
}
