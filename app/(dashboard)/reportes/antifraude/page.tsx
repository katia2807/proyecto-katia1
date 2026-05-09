import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { requestAntifraudeAccess, revokeAntifraudeAccess } from "@/app/(dashboard)/reportes/antifraude/actions";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getCajaRows, getCierresRows, getDashboardSnapshot } from "@/lib/data";
import { canCloseMonth } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

const COOKIE_KEY = "antifraud_access";

export default async function ReporteAntifraudePage() {
  const cookieStore = await cookies();
  const role = await getCurrentUserRole();
  const canAccessAntifraude = canCloseMonth(role);
  const hasPermission = cookieStore.get(COOKIE_KEY)?.value === "granted";

  if (!canAccessAntifraude) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Reporte antifraude</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Este módulo solo está habilitado para owner_admin y gerencia.
          </p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Reporte antifraude</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Acceso restringido: se requiere permiso antes de visualizar este reporte.
          </p>
        </div>

        <Card>
          <CardTitle>Solicitar permiso de acceso</CardTitle>
          <CardDescription>
            Ingresa el código de autorización de jefatura para abrir el reporte antifraude.
          </CardDescription>
          <form action={requestAntifraudeAccess} className="mt-4 grid gap-3 md:grid-cols-3">
            <Field
              label="Código de acceso"
              name="access_code"
              placeholder="Solicitar a la jefa"
              required
              className="md:col-span-2"
            />
            <div className="md:col-span-3">
              <Button>Solicitar permiso</Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  const [caja, cierres, snapshot] = await Promise.all([getCajaRows(), getCierresRows(), getDashboardSnapshot()]);
  const alertas = snapshot.alertas;

  const egresosAltos = caja.filter((x) => x.tipo === "egreso" && Number(x.monto) >= 500);

  const duplicateMap = new Map<string, { count: number; sample: (typeof caja)[number] }>();
  for (const row of caja) {
    const key = `${row.fecha}|${row.categoria}|${row.monto}|${row.tipo}`;
    const current = duplicateMap.get(key);
    if (current) {
      current.count += 1;
    } else {
      duplicateMap.set(key, { count: 1, sample: row });
    }
  }
  const duplicados = [...duplicateMap.values()].filter((x) => x.count > 1);
  const cierresReabiertos = cierres.filter((x) => Boolean(x.reopened_at));
  const alertasCriticas = alertas.filter(
    (a) => a.prioridad === "alta" || a.tipo === "anomalia_caja" || a.tipo === "deuda_vencida",
  );

  const score = Math.max(
    0,
    100 - egresosAltos.length * 10 - duplicados.length * 15 - cierresReabiertos.length * 20 - alertasCriticas.length * 8,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Reporte antifraude</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Monitoreo de anomalías financieras y trazabilidad sin descargas.
          </p>
        </div>
        <form action={revokeAntifraudeAccess}>
          <Button type="submit" variant="secondary">
            Cerrar acceso
          </Button>
        </form>
      </div>

      <div className="flex gap-2">
        <Link href="/reportes">
          <Button type="button" variant="secondary">
            Reporte general
          </Button>
        </Link>
        <Button type="button">Antifraude</Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Índice de confianza" value={`${score}/100`} hint="Más alto = menor riesgo operativo" />
        <MetricCard label="Egresos altos" value={String(egresosAltos.length)} hint="Movimientos de egreso >= S/ 500" />
        <MetricCard label="Movimientos duplicados" value={String(duplicados.length)} hint="Mismo día/categoría/monto" />
        <MetricCard label="Alertas críticas" value={String(alertasCriticas.length)} hint="Anomalías o deuda crítica activa" />
      </section>

      <Card>
        <CardTitle>Resumen de riesgo</CardTitle>
        <CardDescription>Vista rápida para jefa y socios.</CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={score >= 80 ? "success" : score >= 60 ? "warning" : "danger"}>
            {score >= 80 ? "Riesgo bajo" : score >= 60 ? "Riesgo medio" : "Riesgo alto"}
          </Badge>
          <Badge variant={cierresReabiertos.length > 0 ? "warning" : "success"}>
            {cierresReabiertos.length > 0 ? "Hay cierres reabiertos" : "Sin reaperturas de cierre"}
          </Badge>
        </div>
      </Card>

      <Card>
        <CardTitle>Movimientos de egreso alto</CardTitle>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Categoría</TH>
                <TH>Medio</TH>
                <TH className="text-right">Monto</TH>
              </TRow>
            </THead>
            <tbody>
              {egresosAltos.map((row) => (
                <TRow key={row.id}>
                  <TD>{formatDate(row.fecha)}</TD>
                  <TD>{row.categoria}</TD>
                  <TD>{row.medio}</TD>
                  <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Alertas críticas activas</CardTitle>
        <div className="mt-4 space-y-2">
          {alertasCriticas.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[0_10px_22px_-24px_var(--color-accent)]"
            >
              {a.prioridad === "alta" ? (
                <AlertTriangle className="mt-0.5 size-4 text-[var(--color-danger)]" />
              ) : (
                <ShieldCheck className="mt-0.5 size-4 text-[var(--color-warning)]" />
              )}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{a.descripcion}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {a.tipo} · prioridad {a.prioridad} · estado {a.estado}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
