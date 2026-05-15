import Link from "next/link";
import { ReportesCerrarMesPanel } from "@/components/reportes/reportes-cerrar-mes-panel";
import { ReportesExcelExport } from "@/components/reportes/reportes-excel-export";
import { ReporteFila } from "@/components/reportes/reporte-fila";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getCajaRows, getCierresRows, getClientesRows, getCobrosVencidos, getUtilidadRows } from "@/lib/data";
import { canCloseMonth, canExportReportesExcel } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Reportes de auditoria</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Exportacion, origen de datos y detalle trazable. El analisis de decision esta en Panel Gerencial.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Exportaciones</CardTitle>
          <CardDescription>Incluye Excel operativo y kardex completo.</CardDescription>
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
        <CardDescription>Cada fila muestra modulo origen, fecha, usuario y referencia.</CardDescription>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Origen</TH>
                <TH>Categoria</TH>
                <TH className="text-right">Monto</TH>
              </TRow>
            </THead>
            <tbody>
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
        <CardTitle>Cobros a credito vencidos</CardTitle>
        <CardDescription>
          {cobrosVencidos.length === 0
            ? "Sin cobros vencidos. Todo al dia."
            : `${cobrosVencidos.length} comprobantes por un total de ${formatPen(cobrosVencidos.reduce((acc, c) => acc + c.monto, 0))}`}
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
                      <TD className="text-right font-semibold text-[var(--color-danger)]">{formatPen(c.monto)}</TD>
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
        <CardDescription>Vista auditable por periodo. El analisis ejecutivo vive en Panel Gerencial.</CardDescription>
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
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Cierre mensual del periodo seleccionado.</CardDescription>
        </div>
        {canDoCloseMonth ? (
          <ReportesCerrarMesPanel anio={anio} mes={mes} token={token} />
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Solo owner_admin y gerencia pueden ejecutar cierre mensual.
          </p>
        )}
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
