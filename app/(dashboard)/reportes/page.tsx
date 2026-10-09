import Link from "next/link";
import { requirePageAccess } from "@/lib/auth";
import { getReportesData } from "@/lib/reportes-data";
import { fechaHoyPeru } from "@/lib/utils";
import { cookies } from "next/headers";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { submitAntifraudeAccess, revokeAntifraudeAccess } from "@/app/(dashboard)/reportes/antifraude/actions";
import { FeedbackForm } from "@/components/ui/feedback-form";
import { ReportesCerrarMesPanel } from "@/components/reportes/reportes-cerrar-mes-panel";
import { ReportesExcelExport } from "@/components/reportes/reportes-excel-export";
import { ReporteFila } from "@/components/reportes/reporte-fila";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ReportesTabs } from "@/components/reportes/reportes-tabs";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { canCloseMonth, canExportReportesExcel } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";
import { ReportesResumenPanel } from "@/components/reportes/reportes-resumen-panel";
import { buildReportesResumen, normalizeReportesResumen, reportesResumenError, reportesResumenQuery, type ReportesResumenParams } from "@/lib/reportes-resumen";
import { listadoPagina, listadoTamano } from "@/lib/listado-paginacion";

export const dynamic = "force-dynamic";

type ReportesPageProps = {
  searchParams?: Promise<ReportesResumenParams & { por_pagina?: string | string[]; pagina?: string | string[] }>;
};

const COOKIE_KEY = "antifraud_access";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const context = await requirePageAccess("/reportes");
  const params = await searchParams;
  const tab = firstParam(params?.tab);
  const activeTab = ["operaciones","antifraude"].includes(tab) ? tab : "operaciones";

  const cookieStore = await cookies();
  const { utilidad, cierres, caja, cobros: cobrosVencidos, clientes, model } = await getReportesData(context.organizationId);
  const clientesById = new Map(clientes.map(c => [c.id, c]));
  const canDoCloseMonth = canCloseMonth(context.role, context.uiRole);
  const canExcel = canExportReportesExcel(context.role, context.uiRole);
  const filtros = normalizeReportesResumen(params);
  const filtrosError = reportesResumenError(filtros);
  const resumen = filtrosError ? null : buildReportesResumen(caja, filtros);
  const pageSize = listadoTamano(firstParam(params?.por_pagina));
  const pagina = listadoPagina(firstParam(params?.pagina), resumen?.movimientos.length ?? 0, pageSize);
  const rowsVisibles = resumen?.movimientos.slice((pagina - 1) * pageSize, pagina * pageSize) ?? [];
  const seleccionQuery = reportesResumenQuery(filtros);
  const paginaHref = (page: number) => `/reportes?${seleccionQuery ? `${seleccionQuery}&` : ""}por_pagina=${pageSize}&pagina=${page}#movimientos-reportes`;
  const canAccessAntifraude = canDoCloseMonth;
  const hasAntifraudePermission = cookieStore.get(COOKIE_KEY)?.value === "granted";
  const today = fechaHoyPeru();
  const anio = Number(today.slice(0, 4));
  const mes = Number(today.slice(5, 7));
  const token = `CERRAR MES ${anio}-${String(mes).padStart(2, "0")}`;
  const snapshot = canAccessAntifraude && hasAntifraudePermission ? model.cash : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Reportes</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Exportación, trazabilidad y auditoría. El análisis ejecutivo está en el Centro de Mando.
        </p>
      </div>

      <ReportesTabs activeTab={activeTab} canAntifraude={canAccessAntifraude} />

      {/* ── OPERACIONES ── */}
      {activeTab === "operaciones" ? (
        <div className="space-y-6">
          <ReportesResumenPanel resumen={resumen} filtros={filtros} categorias={[...new Set(caja.map(row => row.categoria))].sort()} canExport={canExcel} error={filtrosError} pageSize={pageSize} />
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Exportaciones completas</CardTitle>
              <CardDescription>Archivo operativo de todo el historial, sin los filtros del resumen. Para descargar una selección, usa los botones de arriba.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/reportes/export">
                <Button type="button" variant="secondary">Exportar CSV</Button>
              </Link>
              <ReportesExcelExport canExport={canExcel} />
            </div>
          </Card>

          <Card id="movimientos-reportes" className="scroll-mt-20">
            <CardTitle>Movimientos de caja auditables</CardTitle>
            <CardDescription>Detalle de la selección anterior. Toca una fila para consultar su origen y referencia.</CardDescription>
            <p role="status" className="mt-2 text-xs text-[var(--katia-text-secondary)]">{filtrosError ? "Corrige las fechas para ver el detalle." : `${resumen?.movimientos.length ?? 0} movimientos. Mostrando ${rowsVisibles.length ? (pagina - 1) * pageSize + 1 : 0}–${(pagina - 1) * pageSize + rowsVisibles.length}.`}</p>
            <div role="region" aria-label="Historial desplazable" tabIndex={0} className="mt-4 overflow-x-auto rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Fecha</TH>
                    <TH>Origen</TH>
                    <TH>Categoría</TH>
                    <TH className="text-right">Monto</TH>
                  </TRow>
                </THead>
                <tbody>
                  {rowsVisibles.length === 0 ? (
                    <TRow>
                      <TD colSpan={4} className="text-center text-[var(--katia-text-secondary)]">
                        {filtrosError ? "Fechas no válidas." : "Sin movimientos con esta selección."}
                      </TD>
                    </TRow>
                  ) : null}
                  {rowsVisibles.map((row) => (
                    <ReporteFila
                      key={row.id}
                      detalle={{
                        fecha: row.fecha,
                        monto: row.monto,
                        categoria: row.categoria,
                        modulo: row.modulo_origen ?? "caja",
                        descripcion: row.descripcion ?? undefined,
                        usuario: row.created_by,
                        href: "/caja",
                      }}
                    >
                      <TD>{formatDate(row.fecha)}</TD>
                      <TD>{row.modulo_origen ?? "caja"}</TD>
                      <TD>{row.categoria}</TD>
                      <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                    </ReporteFila>
                  ))}
                </tbody>
              </Table>
            </div>
            {resumen && resumen.movimientos.length > pageSize ? <nav aria-label="Páginas de movimientos de Reportes" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              {pagina > 1 ? <Link href={paginaHref(pagina - 1)} className="rounded-lg border px-3 py-2">Anterior</Link> : <span />}
              <span>Página {pagina} de {Math.ceil(resumen.movimientos.length / pageSize)}</span>
              {pagina * pageSize < resumen.movimientos.length ? <Link href={paginaHref(pagina + 1)} className="rounded-lg border px-3 py-2">Siguiente</Link> : <span />}
            </nav> : null}
          </Card>

          <Card id="cobros-vencidos">
            <CardTitle>Cobros a crédito vencidos</CardTitle>
            <CardDescription>
              {cobrosVencidos.length === 0
                ? "No se encontraron créditos vencidos con fecha registrada. Comprueba créditos sin fecha y pagos no vinculados en Centro de Mando."
                : `${cobrosVencidos.length} crédito(s), saldo conocido ${formatPen(cobrosVencidos.reduce((acc, c) => acc + (c.monto ?? 0), 0))}`}
            </CardDescription>
            {cobrosVencidos.length > 0 ? (
              <div role="region" aria-label="Historial desplazable" tabIndex={0} className="mt-3 overflow-x-auto rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
                <Table>
                  <THead>
                    <TRow>
                      <TH>Origen</TH>
                      <TH>Referencia</TH>
                      <TH>Cliente</TH>
                      <TH>Vencimiento</TH>
                      <TH className="text-right">Monto</TH>
                    </TRow>
                  </THead>
                  <tbody>
                    {cobrosVencidos.map((c) => {
                      const cliente = clientesById.get(c.cliente_id);
                      const href = c.href;
                      return (
                        <ReporteFila
                          key={c.id}
                          detalle={{
                            fecha: c.fecha_vencimiento,
                            monto: c.monto,
                            modulo: c.origen,
                            label: `Cliente: ${cliente?.nombre ?? ""}`,
                            descripcion: `Referencia: ${c.referencia}`,
                            href,
                          }}
                        >
                          <TD className="capitalize">{c.origen.replace(/_/g, " ")}</TD>
                          <TD className="font-mono text-xs">{c.referencia}</TD>
                          <TD>{cliente?.nombre ?? "Sin cliente"}</TD>
                          <TD>{formatDate(c.fecha_vencimiento)}</TD>
                          <TD className="text-right font-semibold text-[var(--katia-danger)]">{c.monto === null ? "Por comprobar" : formatPen(c.monto)}</TD>
                        </ReporteFila>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Resultado de Caja de empresa por mes</CardTitle>
            <CardDescription>Historial completo de empresa, sin los filtros del resumen. Ingresos menos egresos; la nómina es informativa y no se vuelve a descontar. No representa utilidad contable.</CardDescription>
            <div role="region" aria-label="Historial desplazable" tabIndex={0} className="mt-4 overflow-x-auto rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Periodo</TH>
                    <TH className="text-right">Ingresos</TH>
                    <TH className="text-right">Egresos</TH>
                    <TH className="text-right">Nómina registrada</TH>
                    <TH className="text-right">Resultado de Caja</TH>
                  </TRow>
                </THead>
                <tbody>
                  {utilidad.length === 0 ? (
                    <TRow>
                      <TD colSpan={5} className="text-center text-[var(--katia-text-secondary)]">
                        Sin movimientos de empresa o nómina registrados.
                      </TD>
                    </TRow>
                  ) : null}
                  {utilidad.map((row) => (
                    <ReporteFila
                      key={`${row.anio}-${row.mes}`}
                      detalle={{
                        label: `Periodo ${row.mes}/${row.anio}`,
                        monto: row.utilidad_neta,
                        modulo: "utilidad_mensual",
                        descripcion: `Ingresos: ${formatPen(Number(row.ingresos))}, Egresos: ${formatPen(Number(row.egresos))}, Sueldos: ${formatPen(Number(row.sueldos))}`,
                      }}
                    >
                      <TD>{`${String(row.mes).padStart(2, "0")}/${row.anio}`}</TD>
                      <TD className="text-right">{formatPen(Number(row.ingresos))}</TD>
                      <TD className="text-right">{formatPen(Number(row.egresos))}</TD>
                      <TD className="text-right">{formatPen(Number(row.sueldos))}</TD>
                      <TD className="text-right font-semibold">{formatPen(Number(row.utilidad_neta))}</TD>
                    </ReporteFila>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Cierre mensual</CardTitle>
              <CardDescription>Firma el periodo con un hash SHA-256 trazable.</CardDescription>
            </div>
            {canDoCloseMonth ? (
              <ReportesCerrarMesPanel anio={anio} mes={mes} token={token} />
            ) : (
              <p className="rounded-[var(--katia-radius-md)] bg-[var(--katia-warning)]/10 px-3 py-2 text-xs text-[var(--katia-warning)]">
                Solo owner_admin y gerencia pueden ejecutar cierre mensual.
              </p>
            )}
          </Card>

          <Card>
            <CardTitle>Cierres firmados</CardTitle>
            <div role="region" aria-label="Historial desplazable" tabIndex={0} className="mt-4 overflow-x-auto rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Periodo</TH>
                    <TH>Hash SHA-256</TH>
                    <TH>Estado</TH>
                  </TRow>
                </THead>
                <tbody>
                  {cierres.length === 0 ? (
                    <TRow>
                      <TD colSpan={3} className="text-center text-[var(--katia-text-secondary)]">
                        Sin cierres registrados.
                      </TD>
                    </TRow>
                  ) : null}
                  {cierres.map((cierre) => (
                    <TRow key={cierre.id}>
                      <TD>{`${String(cierre.mes).padStart(2, "0")}/${cierre.anio}`}</TD>
                      <TD className="font-mono text-xs">{cierre.hash_sha256.slice(0, 24)}…</TD>
                      <TD>
                        <Badge variant={cierre.reopened_at ? "warning" : "success"}>
                          {cierre.reopened_at ? "reabierto" : "cerrado"}
                        </Badge>
                      </TD>
                    </TRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── ANTIFRAUDE ── */}
      {activeTab === "antifraude" ? (
        <div className="space-y-6">
          {!canAccessAntifraude ? (
            <Card>
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-[var(--katia-warning)]" />
                <div>
                  <CardTitle>Acceso restringido</CardTitle>
                  <CardDescription>Este módulo solo está habilitado para owner_admin y gerencia.</CardDescription>
                </div>
              </div>
            </Card>
          ) : !hasAntifraudePermission ? (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="size-5 text-[var(--katia-warning)]" />
                <div>
                  <CardTitle>Reporte de auditoría antifraude</CardTitle>
                  <CardDescription>
                    Requiere código de autorización para acceder.
                  </CardDescription>
                </div>
              </div>
              <FeedbackForm action={submitAntifraudeAccess} className="grid gap-3 md:grid-cols-3">
                <Field
                  label="Código de acceso"
                  name="access_code"
                  type="password"
                  placeholder="••••••"
                  required
                />
                <div className="md:col-span-2 flex items-end">
                  <Button type="submit">Solicitar acceso</Button>
                </div>
              </FeedbackForm>
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-5 text-[var(--katia-success)]" />
                    <div>
                      <CardTitle>Reporte de auditoría antifraude</CardTitle>
                      <CardDescription>
                        Consulta de registros de empresa y cierres. Acceso temporal validado.
                      </CardDescription>
                    </div>
                  </div>
                  <form action={revokeAntifraudeAccess}>
                    <Button type="submit" variant="ghost" size="sm">Cerrar sesión antifraude</Button>
                  </form>
                </div>
              </Card>

              {snapshot ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--katia-text-tertiary)]">Ingresos declarados</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-[var(--katia-text-primary)]">
                        {formatPen(snapshot.income ?? 0)}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--katia-text-tertiary)]">Egresos declarados</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-[var(--katia-text-primary)]">
                        {formatPen(snapshot.expense ?? 0)}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--katia-text-tertiary)]">Periodo analizado</p>
                      <p className="mt-2 text-2xl font-bold text-[var(--katia-text-primary)]">
                        {String(mes).padStart(2, "0")}/{anio}
                      </p>
                    </Card>
                  </div>
                  <Card>
                    <CardTitle>Análisis de consistencia</CardTitle>
                    <CardDescription>Estos importes resumen Caja; por sí solos no acreditan una auditoría completa.</CardDescription>
                    <div className="mt-4 rounded-[var(--katia-radius-md)] border border-[var(--katia-success)]/30 bg-[var(--katia-success)]/5 px-4 py-3 text-sm text-[var(--katia-success)]">
                      Compara los movimientos y los cierres registrados. La consulta no certifica ausencia de inconsistencias ni sustituye la revisión de comprobantes.
                    </div>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardTitle>Sin datos del periodo</CardTitle>
                  <CardDescription>
                    No hay datos consolidados para {String(mes).padStart(2, "0")}/{anio}. Realiza un cierre mensual para generar el reporte.
                  </CardDescription>
                  <div className="mt-4">
                    <Link href="/reportes?tab=operaciones">
                      <Button variant="secondary" type="button" size="sm">Ir a cierre mensual →</Button>
                    </Link>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
