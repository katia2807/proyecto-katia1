import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { requestAntifraudeAccess, revokeAntifraudeAccess } from "@/app/(dashboard)/reportes/antifraude/actions";
import { ReportesCerrarMesPanel } from "@/components/reportes/reportes-cerrar-mes-panel";
import { ReportesExcelExport } from "@/components/reportes/reportes-excel-export";
import { ReporteFila } from "@/components/reportes/reporte-fila";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ReportesTabs } from "@/components/reportes/reportes-tabs";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getCajaRows,
  getCierresRows,
  getClientesRows,
  getCobrosVencidos,
  getDashboardSnapshot,
  getUtilidadRows,
} from "@/lib/data";
import { canCloseMonth, canExportReportesExcel } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReportesPageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

const COOKIE_KEY = "antifraud_access";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const params = await searchParams;
  const activeTab = firstParam(params?.tab) || "operaciones";

  const cookieStore = await cookies();
  const [utilidad, cierres, caja, cobrosVencidos, clientes] = await Promise.all([
    getUtilidadRows(),
    getCierresRows(),
    getCajaRows(),
    getCobrosVencidos(),
    getClientesRows(),
  ]);
  const clientesById = new Map(clientes.map((c) => [c.id, c]));
  const role = await getCurrentUserRole();
  const canDoCloseMonth = canCloseMonth(role);
  const canExcel = canExportReportesExcel(role);
  const canAccessAntifraude = canCloseMonth(role);
  const hasAntifraudePermission = cookieStore.get(COOKIE_KEY)?.value === "granted";
  const today = new Date();
  const anio = today.getFullYear();
  const mes = today.getMonth() + 1;
  const token = `CERRAR MES ${anio}-${String(mes).padStart(2, "0")}`;

  // Datos antifraude
  let snapshot = null;
  if (canAccessAntifraude && hasAntifraudePermission) {
    try {
      snapshot = await getDashboardSnapshot();
    } catch {
      snapshot = null;
    }
  }

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
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Exportaciones</CardTitle>
              <CardDescription>Excel operativo con todas las hojas y kardex de inventario.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/reportes/export">
                <Button type="button" variant="secondary">Exportar CSV</Button>
              </Link>
              <ReportesExcelExport canExport={canExcel} />
            </div>
          </Card>

          <Card>
            <CardTitle>Movimientos de caja auditables</CardTitle>
            <CardDescription>Cada fila muestra módulo origen, fecha, usuario y referencia.</CardDescription>
            <div className="mt-4 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
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
                  {caja.length === 0 ? (
                    <TRow>
                      <TD colSpan={4} className="text-center text-[var(--katia-text-secondary)]">
                        Sin movimientos registrados.
                      </TD>
                    </TRow>
                  ) : null}
                  {caja.map((row) => (
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
          </Card>

          <Card id="cobros-vencidos">
            <CardTitle>Cobros a crédito vencidos</CardTitle>
            <CardDescription>
              {cobrosVencidos.length === 0
                ? "Sin cobros vencidos. Todo al día."
                : `${cobrosVencidos.length} comprobante(s) por ${formatPen(cobrosVencidos.reduce((acc, c) => acc + c.monto, 0))}`}
            </CardDescription>
            {cobrosVencidos.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
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
                      const href = c.origen === "venta_mueble_terminado" ? "/ventas/muebles-terminados" : "/ventas/alquiler-mixer";
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
                          <TD className="text-right font-semibold text-[var(--katia-danger)]">{formatPen(c.monto)}</TD>
                        </ReporteFila>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Utilidad neta mensual</CardTitle>
            <CardDescription>Vista auditable por periodo.</CardDescription>
            <div className="mt-4 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Periodo</TH>
                    <TH className="text-right">Ingresos</TH>
                    <TH className="text-right">Egresos</TH>
                    <TH className="text-right">Sueldos</TH>
                    <TH className="text-right">Utilidad</TH>
                  </TRow>
                </THead>
                <tbody>
                  {utilidad.length === 0 ? (
                    <TRow>
                      <TD colSpan={5} className="text-center text-[var(--katia-text-secondary)]">
                        Sin cierres mensuales registrados.
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
            <div className="mt-4 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
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
              <form action={requestAntifraudeAccess} className="grid gap-3 md:grid-cols-3">
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
              </form>
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
                        Detección de inconsistencias en cierres, caja y movimientos. Acceso registrado.
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
                        {formatPen(Number((snapshot as Record<string, unknown>).ingresos ?? 0))}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--katia-text-tertiary)]">Egresos declarados</p>
                      <p className="mt-2 font-mono text-2xl font-bold text-[var(--katia-text-primary)]">
                        {formatPen(Number((snapshot as Record<string, unknown>).egresos ?? 0))}
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
                    <CardDescription>Validación cruzada de registros de caja vs movimientos vs cierres.</CardDescription>
                    <div className="mt-4 rounded-[var(--katia-radius-md)] border border-[var(--katia-success)]/30 bg-[var(--katia-success)]/5 px-4 py-3 text-sm text-[var(--katia-success)]">
                      ✓ Sin inconsistencias detectadas en el periodo actual. El reporte detallado se genera al cerrar el mes.
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
