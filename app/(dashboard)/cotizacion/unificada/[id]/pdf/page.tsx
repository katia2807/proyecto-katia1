import { notFound } from "next/navigation";
import { CotizacionResumenFormal } from "@/components/sales/cotizacion-resumen-formal";
import { DocumentoImprimible } from "@/components/sales/documento-imprimible";
import { getEmpresaConfig } from "@/lib/company-config";
import { totalGeneralDetalle } from "@/lib/cotizacion-calculos";
import { buildLineasResumen } from "@/lib/cotizacion-unificada-lineas";
import { parseCotizacionDetalle } from "@/lib/cotizacion-unificada-payload";
import { getCotizacionUnificadaById, getClientesRows } from "@/lib/data";

type PdfPageProps = { params: Promise<{ id: string }> };

export default async function CotizacionUnificadaPdfPage({ params }: PdfPageProps) {
  const { id } = await params;
  const [cot, clientes, empresa] = await Promise.all([
    getCotizacionUnificadaById(id),
    getClientesRows(),
    getEmpresaConfig(),
  ]);
  if (!cot) {
    notFound();
  }
  const cliente = clientes.find((c) => c.id === cot.cliente_id);
  const detalle = parseCotizacionDetalle(cot.detalle as unknown);

  const lineas = buildLineasResumen(detalle);
  const total = totalGeneralDetalle(detalle);

  return (
    <DocumentoImprimible>
      <CotizacionResumenFormal
        correlativoLabel={cot.correlativo ?? `N°${id.slice(0, 8)}`}
        fechaISO={cot.fecha}
        nombreCliente={cliente?.nombre ?? "—"}
        tipoCliente={cot.tipo_cliente}
        documentoCliente={cliente?.documento ?? null}
        lineas={lineas}
        notasGenerales={detalle.notas_generales}
        total={total}
        empresa={empresa}
      />
    </DocumentoImprimible>
  );
}
