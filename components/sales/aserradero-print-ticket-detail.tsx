import type { EmpresaConfig } from "@/lib/company-config";
import type { AserraderoPrintModel } from "@/lib/aserradero-print-model";
import { formatPen } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";
import { PrintSelector } from "@/components/ui/print-selector";

type AserraderoPrintTicketDetailProps = {
  id: string;
  empresa: EmpresaConfig;
  model: AserraderoPrintModel;
};

function formatDate(value: string) {
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-PE");
  } catch {
    return value;
  }
}

function displayPaymentValue(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export function AserraderoPrintTicketDetail({
  id,
  empresa,
  model,
}: AserraderoPrintTicketDetailProps) {
  const hasAdjustment = model.totals.ajusteAlTotal !== 0;
  const docLabel = model.identity.tipoComprobante === "factura" ? "FACTURA" : "BOLETA";

  return (
    <>
      <style>{`
        .aserradero-ticket {
          width: 72mm;
          max-width: 72mm;
          height: auto;
          min-height: 0;
          margin: 20px auto;
          padding: 2mm 1mm 4mm;
          background: white;
          color: black;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10.5px;
          line-height: 1.25;
        }
        .aserradero-ticket-block {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @page { size: 80mm auto; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body {
            width: 80mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          .aserradero-ticket {
            width: 72mm !important;
            max-width: 72mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
        @media screen {
          body { background: #0f172a; }
          .aserradero-ticket { box-shadow: 0 10px 25px rgba(0,0,0,.35); }
        }
      `}</style>

      <div className="no-print sticky top-0 z-50 flex w-full items-center justify-between gap-4 border-b border-[#334155] bg-[#1e293b] px-6 py-3 shadow">
        <a href="/ventas/aserradero-servicios" className="text-sm text-[#94a3b8] transition-colors hover:text-white">
          ← Volver
        </a>
        <div className="flex items-center gap-4">
          <PrintSelector
            id={id}
            currentFormat="ticket"
            docType={model.identity.tipoComprobante}
            tipoSale="aserradero"
          />
          <PrintButton />
        </div>
      </div>

      <main className="aserradero-ticket">
        <header className="text-center">
          <p className="text-[13px] font-black uppercase">{empresa.nombre}</p>
          {empresa.ruc ? <p>RUC: {empresa.ruc}</p> : null}
          {empresa.direccion ? <p>{empresa.direccion}</p> : null}
          {empresa.telefono ? <p>TEL: {empresa.telefono}</p> : null}
          <div className="my-1 border-t border-dashed border-black" />
          <p className="font-black">{docLabel} N.º {model.identity.numero}</p>
        </header>

        <div className="my-1 border-t border-dashed border-black" />
        <section className="space-y-0.5">
          <p><strong>FECHA:</strong> {formatDate(model.identity.fecha)}</p>
          <p><strong>CLIENTE:</strong> {model.customer.nombre}</p>
          {model.customer.documento ? (
            <p><strong>{model.customer.tipoDocumento}:</strong> {model.customer.documento}</p>
          ) : null}
        </section>

        <div className="my-1 border-t border-dashed border-black" />
        {model.blocks.length > 0 ? (
          <section>
            <p className="mb-1 font-bold">Medidas: esp(in) ancho(in) largo(ft)</p>
            <div className="space-y-1">
              {model.blocks.map((block) => (
                <div key={block.indice} className="aserradero-ticket-block">
                  <div className="flex justify-between gap-2">
                    <span>
                      #{String(block.indice).padStart(2, "0")} {block.espesor} {block.ancho} {block.largo}
                    </span>
                    {block.cantidad !== 1 ? <span>Cant. {block.cantidad}</span> : null}
                  </div>
                  <p className="text-right font-bold">
                    {block.ptTotalComercial} PT{block.cantidad !== 1 ? " total" : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <p className="font-black">RESUMEN DE MADERA CUBICADA</p>
            {model.historical.piesCubicosRegistrados !== null ? (
              <p>Volumen histórico: {model.historical.piesCubicosRegistrados.toFixed(2)} ft³</p>
            ) : null}
            <p className="font-semibold">Tarifa no registrada</p>
          </section>
        )}

        {model.additionalServices.length > 0 ? (
          <>
            <div className="my-1 border-t border-dashed border-black" />
            <section>
              <p className="font-black">SERVICIOS ADICIONALES</p>
              {model.additionalServices.map((service, index) => (
                <div key={`${service.nombre}-${index}`} className="aserradero-ticket-block flex justify-between gap-2">
                  <span>{service.cantidad} × {service.nombre}</span>
                  <span className="font-semibold">{formatPen(service.subtotal)}</span>
                </div>
              ))}
            </section>
          </>
        ) : null}

        {model.historical.notas.length > 0 ? (
          <p className="mt-1 text-[9px]">
            <strong>Nota histórica:</strong> madera del cliente: {model.historical.notas.join("; ")}
          </p>
        ) : null}

        <div className="my-1 border-t border-dashed border-black" />
        <dl className="space-y-0.5">
          <div className="flex justify-between gap-2"><dt>BLOQUES</dt><dd>{model.totals.totalBloques || "N/R"}</dd></div>
          <div className="flex justify-between gap-2">
            <dt>TOTAL PIES</dt>
            <dd>{model.totals.totalPTComercial === null ? "NO REGISTRADO" : `${model.totals.totalPTComercial} PT`}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>TARIFA CORTE</dt>
            <dd>{model.totals.tarifaPorPT === null ? "NO REGISTRADA" : formatPen(model.totals.tarifaPorPT)}</dd>
          </div>
          <div className="flex justify-between gap-2"><dt>SUBTOTAL CORTE</dt><dd>{formatPen(model.totals.subtotalCorte)}</dd></div>
          {model.additionalServices.length > 0 ? (
            <div className="flex justify-between gap-2"><dt>SERVICIOS</dt><dd>{formatPen(model.totals.subtotalAdicionales)}</dd></div>
          ) : null}
          {hasAdjustment ? (
            <div className="flex justify-between gap-2"><dt>AJUSTE</dt><dd>{formatPen(model.totals.ajusteAlTotal)}</dd></div>
          ) : null}
          <div className="mt-1 flex justify-between gap-2 border-t border-black pt-1 text-[12px] font-black">
            <dt>TOTAL SERVICIO</dt>
            <dd>{formatPen(model.totals.totalCobrado)}</dd>
          </div>
        </dl>

        <div className="my-1 border-t border-dashed border-black" />
        <section className="space-y-0.5">
          <p><strong>PAGO:</strong> {displayPaymentValue(model.payment.modalidad)} · {displayPaymentValue(model.payment.metodo)}</p>
          {model.payment.modalidad === "adelanto" ? (
            <>
              <p><strong>ADELANTO:</strong> {formatPen(model.payment.adelanto)}</p>
              <p><strong>SALDO:</strong> {formatPen(model.payment.saldo)}</p>
            </>
          ) : null}
          {model.payment.modalidad === "credito" && model.payment.fechaCredito ? (
            <p><strong>VENCE:</strong> {formatDate(model.payment.fechaCredito)}</p>
          ) : null}
        </section>
        <div className="my-1 border-t border-dashed border-black" />
        <p className="text-center font-semibold">Gracias por su preferencia</p>
      </main>
    </>
  );
}
