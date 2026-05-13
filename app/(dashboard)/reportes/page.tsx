import Link from "next/link";
import { ReportesCerrarMesPanel } from "@/components/reportes/reportes-cerrar-mes-panel";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { WhatsAppButton } from "@/components/sales/whatsapp-button";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getCajaRows,
  getCierresRows,
  getClientesRows,
  getCobrosVencidos,
  getUtilidadRows,
} from "@/lib/data";
import { canCloseMonth, canExportReportesExcel } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";
import { ReportesExcelExport } from "@/components/reportes/reportes-excel-export";

export default async function ReportesPage() {
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

  const today = new Date();
  const anio = today.getFullYear();
  const mes = today.getMonth() + 1;
  const token = `CERRAR MES ${anio}-${String(mes).padStart(2, "0")}`;

  const actual = utilidad[0];
  const ingresosActual = Number(actual?.ingresos ?? 0);
  const egresosActual = Number(actual?.egresos ?? 0);
  const sueldosActual = Number(actual?.sueldos ?? 0);
  const utilidadActual = Number(actual?.utilidad_neta ?? ingresosActual - egresosActual - sueldosActual);
  const flujoNetoCaja = ingresosActual - egresosActual;

  const ingresosPorModulo = caja
    .filter((x) => x.tipo === "ingreso")
    .reduce<Record<string, number>>((acc, row) => {
      const key = row.modulo_origen ?? "sin_modulo";
      acc[key] = (acc[key] ?? 0) + Number(row.monto);
      return acc;
    }, {});

  const egresosRelevantes = caja
    .filter((x) => x.tipo === "egreso")
    .sort((a, b) => Number(b.monto) - Number(a.monto))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Reportes gerenciales</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Utilidad neta mensual, exportación y cierre inmutable para socios.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/reportes/antifraude">
          <Button type="button" variant="secondary">
            Antifraude (con permisos)
          </Button>
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Ingresos del periodo" value={formatPen(ingresosActual)} hint="Total ingresos registrados" />
        <MetricCard label="Egresos del periodo" value={formatPen(egresosActual)} hint="Total egresos operativos" />
        <MetricCard label="Nómina del periodo" value={formatPen(sueldosActual)} hint="Sueldos y descuentos aplicados" />
        <MetricCard label="Utilidad neta" value={formatPen(utilidadActual)} hint="Ingresos - egresos - sueldos" />
        <MetricCard label="Flujo neto de caja" value={formatPen(flujoNetoCaja)} hint="Ingresos - egresos (sin nómina)" />
      </section>

      <Card>
        <CardTitle>Reporte ejecutivo para jefa y socios</CardTitle>
        <CardDescription>
          Vista general, clara y sin necesidad de descargar archivos para supervisión diaria.
        </CardDescription>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Módulo origen</TH>
                  <TH className="text-right">Ingreso acumulado</TH>
                </TRow>
              </THead>
              <tbody>
                {Object.entries(ingresosPorModulo).map(([modulo, monto]) => (
                  <TRow key={modulo}>
                    <TD>{modulo}</TD>
                    <TD className="text-right font-semibold">{formatPen(monto)}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Top egresos</TH>
                  <TH>Fecha</TH>
                  <TH className="text-right">Monto</TH>
                </TRow>
              </THead>
              <tbody>
                {egresosRelevantes.map((row) => (
                  <TRow key={row.id}>
                    <TD>{row.categoria}</TD>
                    <TD>{formatDate(row.fecha)}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Utilidad neta mensual</CardTitle>
        <CardDescription>
          Ingresos - egresos - nómina. Exporta en CSV para socios y trazabilidad.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/reportes/export">
            <Button type="button" variant="secondary">
              Exportar CSV
            </Button>
          </Link>
          <ReportesExcelExport canExport={canExcel} />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
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
              {utilidad.map((row) => (
                <TRow key={`${row.anio}-${row.mes}`}>
                  <TD>{`${String(row.mes).padStart(2, "0")}/${row.anio}`}</TD>
                  <TD className="text-right">{formatPen(Number(row.ingresos))}</TD>
                  <TD className="text-right">{formatPen(Number(row.egresos))}</TD>
                  <TD className="text-right">{formatPen(Number(row.sueldos))}</TD>
                  <TD className="text-right font-semibold">{formatPen(Number(row.utilidad_neta))}</TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Cierre mensual del período seleccionado.</CardDescription>
        </div>
        {canDoCloseMonth ? (
          <ReportesCerrarMesPanel anio={anio} mes={mes} token={token} />
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Solo owner_admin y gerencia pueden ejecutar cierre mensual.
          </p>
        )}
      </Card>

      <Card id="cobros-vencidos">
        <CardTitle>Cobros a crédito vencidos</CardTitle>
        <CardDescription>
          {cobrosVencidos.length === 0
            ? "Sin cobros vencidos. Todo al día."
            : `${cobrosVencidos.length} comprobantes por un total de ${formatPen(
                cobrosVencidos.reduce((acc, c) => acc + c.monto, 0),
              )}`}
        </CardDescription>
        {cobrosVencidos.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Origen</TH>
                  <TH>Referencia</TH>
                  <TH>Cliente</TH>
                  <TH>Vencimiento</TH>
                  <TH className="text-right">Monto</TH>
                  <TH className="text-right">Reclamar</TH>
                </TRow>
              </THead>
              <tbody>
                {cobrosVencidos.map((c) => {
                  const cliente = clientesById.get(c.cliente_id);
                  const mensaje = `Hola ${cliente?.nombre ?? ""}, te recuerdo el pago pendiente del comprobante ${c.referencia} por ${formatPen(c.monto)}, vencido el ${formatDate(c.fecha_vencimiento)}.`;
                  return (
                    <TRow key={c.id}>
                      <TD className="capitalize">{c.origen.replace(/_/g, " ")}</TD>
                      <TD className="font-mono text-xs">{c.referencia}</TD>
                      <TD>{cliente?.nombre ?? "—"}</TD>
                      <TD>{formatDate(c.fecha_vencimiento)}</TD>
                      <TD className="text-right font-semibold text-[var(--color-danger)]">
                        {formatPen(c.monto)}
                      </TD>
                      <TD className="text-right">
                        <WhatsAppButton
                          telefono={cliente?.telefono ?? null}
                          mensaje={mensaje}
                          variant="pill"
                        />
                      </TD>
                    </TRow>
                  );
                })}
              </tbody>
            </Table>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Cierres firmados</CardTitle>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Periodo</TH>
                <TH>Hash SHA-256</TH>
                <TH>Estado</TH>
              </TRow>
            </THead>
            <tbody>
              {cierres.map((cierre) => (
                <TRow key={cierre.id}>
                  <TD>{`${String(cierre.mes).padStart(2, "0")}/${cierre.anio}`}</TD>
                  <TD className="font-mono text-xs">{cierre.hash_sha256.slice(0, 24)}...</TD>
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
  );
}
