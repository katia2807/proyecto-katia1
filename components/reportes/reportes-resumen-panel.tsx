import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { ReportesResumenFiltrosForm } from "@/components/reportes/reportes-resumen-filtros";
import { cajaCategoriaLabel } from "@/lib/caja-presentacion";
import { formatPen } from "@/lib/utils";
import { reportesResumenAlcance, reportesResumenQuery, type ReportesResumen, type ReportesResumenFiltros } from "@/lib/reportes-resumen";

export function ReportesResumenPanel({ resumen, filtros, categorias, canExport, error, pageSize }: { resumen: ReportesResumen | null; filtros: ReportesResumenFiltros; categorias: string[]; canExport: boolean; error: string | null; pageSize: number }) {
  const query = reportesResumenQuery(filtros);
  const exportLinkClass = "inline-flex min-h-10 items-center justify-center rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] bg-[var(--katia-glass-bg)] px-4 py-2 text-sm font-semibold text-[var(--katia-text-primary)] transition-colors hover:bg-[var(--katia-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--katia-primary)] focus-visible:ring-offset-2";
  return <Card id="resumen-caja" className="scroll-mt-20 space-y-4">
    <div><CardTitle>Resumen de movimientos de Caja</CardTitle><CardDescription>Selecciona fechas, categoría y ámbito. El resumen, el detalle y sus archivos usan la misma selección.</CardDescription></div>
    <ReportesResumenFiltrosForm key={`${query}:${pageSize}`} filtros={filtros} categorias={categorias} pageSize={pageSize} />
    {error ? <p role="alert" className="text-sm text-[var(--katia-danger)]">{error} No se generará un archivo con estas fechas.</p> : resumen ? <>
      <p role="status" className="text-sm text-[var(--katia-text-secondary)]">{resumen.movimientos.length} movimientos · {reportesResumenAlcance(filtros)}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[{label:"Ingresos de la selección",valor:resumen.ingresos},{label:"Gastos de la selección",valor:resumen.gastos},{label:"Resultado de la selección",valor:resumen.resultado}].map(item => <div key={item.label} className="rounded-xl border border-[var(--katia-border-subtle)] p-3"><p className="text-xs text-[var(--katia-text-secondary)]">{item.label}</p><p className="mt-1 text-lg font-semibold">{formatPen(item.valor)}</p></div>)}
      </div>
      <p className="text-xs text-[var(--katia-text-secondary)]">Ingresos menos gastos; no representa utilidad contable. Las transferencias ({resumen.transferencias}) no se suman a estos importes. Empresa y personal se distinguen en cada fila.</p>
      {canExport ? <div className="flex flex-wrap gap-2">
        <a className={exportLinkClass} href={`/api/export/reportes-resumen?formato=excel${query ? `&${query}` : ""}`}>Excel de la selección</a>
        <a className={exportLinkClass} href={`/api/export/reportes-resumen?formato=csv${query ? `&${query}` : ""}`}>CSV de movimientos</a>
        <Link className={exportLinkClass} href={`/print/reportes${query ? `?${query}` : ""}`} target="_blank" rel="noopener noreferrer" prefetch={false}>Resumen PDF</Link>
      </div> : <p className="text-xs text-[var(--katia-text-secondary)]">Solo dueña y gerencia pueden exportar los archivos.</p>}
      <div role="region" aria-label="Resumen por categoría" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-[var(--katia-border-subtle)]">
        <Table><THead><TRow><TH>Categoría</TH><TH>Ámbito</TH><TH className="text-right">Movimientos</TH><TH className="text-right">Ingresos</TH><TH className="text-right">Gastos</TH><TH className="text-right">Resultado</TH></TRow></THead>
          <tbody>{resumen.categorias.length ? resumen.categorias.map(row => <TRow key={`${row.esPersonal}:${row.categoria}`}><TD>{cajaCategoriaLabel(row.categoria)}</TD><TD>{row.esPersonal ? "Personal" : "Empresa"}</TD><TD className="text-right">{row.movimientos}</TD><TD className="text-right">{formatPen(row.ingresos)}</TD><TD className="text-right">{formatPen(row.gastos)}</TD><TD className="text-right font-semibold">{formatPen(row.resultado)}</TD></TRow>) : <TRow><TD colSpan={6} className="text-center">No hay movimientos con esta selección.</TD></TRow>}</tbody>
        </Table>
      </div>
    </> : null}
  </Card>;
}
