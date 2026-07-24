import type { EmpresaConfig } from "@/lib/company-config";
import type { AserraderoPrintModel } from "@/lib/aserradero-print-model";
import { formatPen } from "@/lib/utils";
import { PrintButton } from "@/components/ui/print-button";
import { PrintSelector } from "@/components/ui/print-selector";

type AserraderoPrintA4DetailProps = {
  id: string;
  empresa: EmpresaConfig;
  model: AserraderoPrintModel;
  currentFormat: "a4" | "default";
};

function formatDate(value: string) {
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function displayPaymentValue(value: string) {
  return value.replaceAll("_", " ");
}

export function AserraderoPrintA4Detail({
  id,
  empresa,
  model,
  currentFormat,
}: AserraderoPrintA4DetailProps) {
  const showQuantity = model.blocks.some((block) => block.cantidad !== 1);
  const hasAdjustment = model.totals.ajusteAlTotal !== 0;
  const docLabel = model.identity.tipoComprobante === "factura" ? "FACTURA" : "BOLETA";

  return (
    <>
      <style>{`
        @page { size: A4; margin: 9mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: white !important; color: #111827 !important; }
          .aserradero-a4-page {
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .aserradero-a4-table thead { display: table-header-group; }
          .aserradero-a4-table tbody { break-inside: auto; page-break-inside: auto; }
          .aserradero-a4-table tr { break-inside: avoid; page-break-inside: avoid; }
          .aserradero-a4-summary { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          body { background: #e2e8f0; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[#334155] bg-[#1e293b] px-6 py-3 shadow">
        <a href="/ventas/aserradero-servicios" className="text-sm text-[#94a3b8] transition-colors hover:text-white">
          ← Volver
        </a>
        <div className="flex items-center gap-4">
          <PrintSelector
            id={id}
            currentFormat={currentFormat}
            docType={model.identity.tipoComprobante}
            tipoSale="aserradero"
          />
          <PrintButton />
        </div>
      </div>

      <main className="aserradero-a4-page mx-auto my-5 w-[min(210mm,calc(100%-24px))] rounded-xl border border-slate-300 bg-white p-6 text-[11px] leading-snug text-slate-950 shadow-lg">
        <header className="grid grid-cols-[1fr_auto] items-start gap-5 border-b-2 border-slate-900 pb-3">
          <div>
            <h1 className="text-base font-black uppercase tracking-wide">{empresa.nombre}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-600">
              {empresa.ruc ? <span><strong>RUC:</strong> {empresa.ruc}</span> : null}
              {empresa.direccion ? <span><strong>Dirección:</strong> {empresa.direccion}</span> : null}
              {empresa.telefono ? <span><strong>Teléfono:</strong> {empresa.telefono}</span> : null}
            </div>
          </div>
          <div className="min-w-48 border-l-2 border-slate-900 pl-4 text-right">
            <p className="text-xs font-black tracking-widest">{docLabel}</p>
            <p className="text-base font-black">N.º {model.identity.numero}</p>
            <p className="text-[10px] text-slate-600">{formatDate(model.identity.fecha)}</p>
          </div>
        </header>

        <section className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-slate-300 bg-slate-50 px-3 py-2">
          <span className="font-bold uppercase text-slate-500">Cliente</span>
          <span className="font-semibold">{model.customer.nombre}</span>
          {model.customer.documento ? (
            <span>
              <strong>{model.customer.tipoDocumento}:</strong> {model.customer.documento}
            </span>
          ) : null}
        </section>

        <section className="mt-3">
          {model.blocks.length > 0 ? (
            <table className="aserradero-a4-table w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-y border-slate-400 bg-slate-100">
                  <th className="px-2 py-1.5 text-left">N.º</th>
                  {showQuantity ? <th className="px-2 py-1.5 text-right">Cant.</th> : null}
                  <th className="px-2 py-1.5 text-right">Espesor (in)</th>
                  <th className="px-2 py-1.5 text-right">Ancho (in)</th>
                  <th className="px-2 py-1.5 text-right">Largo (ft)</th>
                  <th className="px-2 py-1.5 text-right">Pies tablares (PT)</th>
                </tr>
              </thead>
              <tbody>
                {model.blocks.map((block) => (
                  <tr key={block.indice} className="border-b border-slate-200">
                    <td className="px-2 py-1.5">{block.indice}</td>
                    {showQuantity ? <td className="px-2 py-1.5 text-right">{block.cantidad}</td> : null}
                    <td className="px-2 py-1.5 text-right">{block.espesor}</td>
                    <td className="px-2 py-1.5 text-right">{block.ancho}</td>
                    <td className="px-2 py-1.5 text-right">{block.largo}</td>
                    <td className="px-2 py-1.5 text-right font-bold">{block.ptTotalComercial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded border border-slate-300 bg-slate-50 px-3 py-2">
              <p className="font-black uppercase tracking-wide">Resumen de madera cubicada</p>
              {model.historical.piesCubicosRegistrados !== null ? (
                <p className="mt-1 text-slate-700">
                  Volumen histórico registrado: {model.historical.piesCubicosRegistrados.toFixed(2)} ft³
                </p>
              ) : null}
              <p className="mt-1 font-semibold">Tarifa no registrada</p>
            </div>
          )}
        </section>

        {model.additionalServices.length > 0 ? (
          <section className="mt-3">
            <h2 className="mb-1 font-black uppercase tracking-wide text-slate-600">Servicios adicionales</h2>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-y border-slate-300 bg-slate-50">
                  <th className="px-2 py-1 text-left">Servicio</th>
                  <th className="px-2 py-1 text-right">Cant.</th>
                  <th className="px-2 py-1 text-right">Tarifa</th>
                  <th className="px-2 py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {model.additionalServices.map((service, index) => (
                  <tr key={`${service.nombre}-${index}`} className="border-b border-slate-200">
                    <td className="px-2 py-1">{service.nombre}</td>
                    <td className="px-2 py-1 text-right">{service.cantidad}</td>
                    <td className="px-2 py-1 text-right">{formatPen(service.tarifa)}</td>
                    <td className="px-2 py-1 text-right font-semibold">{formatPen(service.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {model.historical.notas.length > 0 ? (
          <p className="mt-2 text-[9px] text-slate-500">
            <strong>Nota histórica:</strong> madera del cliente: {model.historical.notas.join("; ")}
          </p>
        ) : null}

        <section className="aserradero-a4-summary mt-3 grid grid-cols-[1fr_minmax(240px,38%)] gap-4 border-t-2 border-slate-900 pt-2">
          <div className="self-end border-y border-slate-300 py-2 text-[10px]">
            <strong>Pago:</strong> {displayPaymentValue(model.payment.modalidad)} · {displayPaymentValue(model.payment.metodo)}
            {model.payment.modalidad === "adelanto" ? (
              <> · Adelanto {formatPen(model.payment.adelanto)} · Saldo {formatPen(model.payment.saldo)}</>
            ) : null}
            {model.payment.modalidad === "credito" && model.payment.fechaCredito ? (
              <> · Vence {formatDate(model.payment.fechaCredito)}</>
            ) : null}
          </div>

          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[10px]">
            <dt>Bloques</dt>
            <dd className="text-right font-semibold">{model.totals.totalBloques || "No registrado"}</dd>
            <dt>Total pies tablares</dt>
            <dd className="text-right font-semibold">
              {model.totals.totalPTComercial === null ? "No registrado" : `${model.totals.totalPTComercial} PT`}
            </dd>
            <dt>Tarifa de corte por PT</dt>
            <dd className="text-right font-semibold">
              {model.totals.tarifaPorPT === null ? "Tarifa no registrada" : formatPen(model.totals.tarifaPorPT)}
            </dd>
            <dt>Subtotal del corte</dt>
            <dd className="text-right font-semibold">{formatPen(model.totals.subtotalCorte)}</dd>
            {model.additionalServices.length > 0 ? (
              <>
                <dt>Servicios adicionales</dt>
                <dd className="text-right font-semibold">{formatPen(model.totals.subtotalAdicionales)}</dd>
              </>
            ) : null}
            {hasAdjustment ? (
              <>
                <dt>Ajuste al total</dt>
                <dd className="text-right font-semibold">{formatPen(model.totals.ajusteAlTotal)}</dd>
              </>
            ) : null}
            <dt className="border-t border-slate-900 pt-1 text-xs font-black">TOTAL SERVICIO</dt>
            <dd className="border-t border-slate-900 pt-1 text-right text-sm font-black">
              {formatPen(model.totals.totalCobrado)}
            </dd>
          </dl>
        </section>

        <footer className="aserradero-a4-summary mt-5 flex justify-end text-[9px] text-slate-500">
          <span className="inline-block min-w-52 border-t border-slate-400 pt-1 text-center">Conformidad del cliente</span>
        </footer>
      </main>
    </>
  );
}
