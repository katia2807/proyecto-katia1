import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageAccess } from "@/lib/auth";
import { canExportReportesExcel } from "@/lib/permissions";
import { getReportesData } from "@/lib/reportes-data";
import { buildReportesResumen, normalizeReportesResumen, reportesResumenAlcance, reportesResumenError, reportesResumenQuery, type ReportesResumenParams } from "@/lib/reportes-resumen";
import { cajaCategoriaLabel } from "@/lib/caja-presentacion";
import { DocumentoImprimible } from "@/components/sales/documento-imprimible";
import { fechaHoyPeru, formatDate, formatPen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportesPdfPage({ searchParams }: {searchParams: Promise<ReportesResumenParams>}) {
  const context = await requirePageAccess("/reportes");
  if (!canExportReportesExcel(context.role,context.uiRole)) redirect("/reportes");
  const filtros = normalizeReportesResumen(await searchParams);
  const error = reportesResumenError(filtros);
  const query = reportesResumenQuery(filtros);
  if (error) return <main className="p-6"><p role="alert">{error}</p><Link href={`/reportes?${query}#resumen-caja`}>Volver a Reportes</Link></main>;
  const data = await getReportesData(context.organizationId);
  const resumen = buildReportesResumen(data.caja,filtros);
  return <DocumentoImprimible>
    <style>{`@media print { @page { size: A4; margin: 14mm; } .doc-paper { margin: 0; padding: 0; border: 0; box-shadow: none; max-width: none; } thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
    <div className="no-print mb-4"><Link href={`/reportes${query?`?${query}`:""}#resumen-caja`} className="underline">Volver a la selección de Reportes</Link></div>
    <h1 className="text-2xl font-bold">Katia Suite · Resumen de Caja</h1>
    <p className="mt-2 text-sm">Emitido: {formatDate(fechaHoyPeru())}</p>
    <p className="mt-2 text-sm">{reportesResumenAlcance(filtros)}</p>
    <p className="mt-3 text-sm">{resumen.movimientos.length} movimientos · Ingresos: {formatPen(resumen.ingresos)} · Gastos: {formatPen(resumen.gastos)} · Resultado: {formatPen(resumen.resultado)}</p>
    <p className="mt-2 text-xs">Ingresos menos gastos. Transferencias ({resumen.transferencias}) excluidas. No representa utilidad contable; empresa y personal se muestran por separado.</p>
    <h2 className="my-4 font-semibold">Resumen por categoría</h2>
    <div className="overflow-x-auto print:overflow-visible"><table><thead><tr><th>Categoría</th><th>Ámbito</th><th>Movimientos</th><th>Ingresos</th><th>Gastos</th><th>Resultado</th></tr></thead><tbody>
      {resumen.categorias.map(row=><tr key={`${row.esPersonal}:${row.categoria}`}><td>{cajaCategoriaLabel(row.categoria)}</td><td>{row.esPersonal?"Personal":"Empresa"}</td><td>{row.movimientos}</td><td>{formatPen(row.ingresos)}</td><td>{formatPen(row.gastos)}</td><td>{formatPen(row.resultado)}</td></tr>)}
      {!resumen.categorias.length?<tr><td colSpan={6}>No hay movimientos con esta selección.</td></tr>:null}
    </tbody></table></div>
  </DocumentoImprimible>;
}
