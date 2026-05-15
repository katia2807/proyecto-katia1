import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { MetricCard } from "@/components/metric-card";
import { OnboardingBanner } from "@/components/onboarding-banner";
import {
  DashboardDataUnavailableError,
  emptyDashboardSnapshot,
  getClientesRows,
  getCotizacionesUnificadasRows,
  getDashboardSnapshot,
  getInventarioResumen,
  getPersonalRows,
} from "@/lib/data";
import { getEmpresaConfig } from "@/lib/company-config";
import { formatDate, formatPen } from "@/lib/utils";

type DashboardPageProps = {
  searchParams?: Promise<{ mensaje?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const mensaje = firstParam((await searchParams)?.mensaje);
  let dashboardLoadError: string | null = null;
  let snapshot = emptyDashboardSnapshot();
  try {
    snapshot = await getDashboardSnapshot();
  } catch (e) {
    dashboardLoadError =
      e instanceof DashboardDataUnavailableError
        ? e.message
        : "No se pudieron cargar los datos del panel desde la base de datos.";
  }

  const { caja, ventas, alquileres, empleados, alertas, utilidad, ingresosMesActual, egresosMesActual } = snapshot;

  const [inventario, personal, clientes, cotizaciones, empresa] = await Promise.all([
    getInventarioResumen(),
    getPersonalRows(),
    getClientesRows(),
    getCotizacionesUnificadasRows(),
    getEmpresaConfig().catch(() => null),
  ]);
  const ventasBorrador = ventas.filter((venta) => venta.estado === "borrador").length;
  const stockBajo = inventario.stockBajo.length;
  const penalidadesActivas = alquileres.filter((row) => Number(row.penalidad) > 0 && row.estado !== "cerrado").length;
  const adelantosPendientes = personal.adelantos.filter((row) => row.estado === "pendiente").length;
  const alertasCriticas = alertas.filter((row) => row.prioridad === "alta").length;
  const accionesHoy = [
    {
      href: "/inventario?tab=alertas#alertas-stock",
      titulo: "Reponer stock bajo",
      detalle: `${stockBajo} producto(s) por debajo del mínimo.`,
      prioridad: stockBajo > 0 ? "Alta" : "OK",
    },
    {
      href: "/reportes/antifraude",
      titulo: "Revisar alertas críticas",
      detalle: `${alertasCriticas} alerta(s) de prioridad alta.`,
      prioridad: alertasCriticas > 0 ? "Alta" : "OK",
    },
    {
      href: "/ventas#ventas-borrador",
      titulo: "Confirmar ventas en borrador",
      detalle: `${ventasBorrador} venta(s) pendientes de confirmar.`,
      prioridad: ventasBorrador > 0 ? "Media" : "OK",
    },
    {
      href: "/personal#adelantos-pendientes",
      titulo: "Regularizar adelantos",
      detalle: `${adelantosPendientes} adelanto(s) por descontar o cerrar.`,
      prioridad: adelantosPendientes > 0 ? "Media" : "OK",
    },
  ];

  return (
    <div className="space-y-6">
      {mensaje === "no-acceso" ? (
        <Card className="border-[var(--color-danger)] bg-[var(--color-primary-soft)]">
          <CardTitle className="text-[var(--color-danger)]">No tienes acceso a esta sección</CardTitle>
          <CardDescription>Tu rol no tiene permisos para el módulo solicitado.</CardDescription>
        </Card>
      ) : null}
      {dashboardLoadError ? (
        <section>
          <Card className="border-[var(--color-danger)] bg-[var(--color-primary-soft)]">
            <CardTitle className="text-[var(--color-danger)]">Error al cargar datos del panel</CardTitle>
            <CardDescription className="mt-2 text-[var(--color-text-primary)]">{dashboardLoadError}</CardDescription>
          </Card>
        </section>
      ) : null}

      <OnboardingBanner
        steps={[
          { label: "Configura empresa", done: Boolean(empresa?.nombre), href: "/admin/empresa" },
          { label: "Agrega productos", done: inventario.productos.length > 0, href: "/inventario?tab=productos" },
          { label: "Registra cliente", done: clientes.length > 0, href: "/ventas?quick=cliente" },
          { label: "Crea cotizacion", done: cotizaciones.length > 0, href: "/cotizacion" },
        ]}
      />

      <section>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Resumen operativo</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Lo más importante para atender hoy, con acceso directo en un clic.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardTitle>Stock por revisar</CardTitle>
          <CardDescription className="mt-1">{stockBajo} producto(s) por agotarse.</CardDescription>
          <Link href="/inventario?tab=alertas#alertas-stock" className="mt-3 inline-flex">
            <Button type="button" variant="secondary">
              Ir a inventario
            </Button>
          </Link>
        </Card>

        <Card>
          <CardTitle>Penalidades activas</CardTitle>
          <CardDescription className="mt-1">{penalidadesActivas} contrato(s) con penalidad.</CardDescription>
          <Link href="/alquiler#penalidades-activas" className="mt-3 inline-flex">
            <Button type="button" variant="secondary">
              Revisar maquinaria
            </Button>
          </Link>
        </Card>

        <Card>
          <CardTitle>Adelantos pendientes</CardTitle>
          <CardDescription className="mt-1">{adelantosPendientes} adelanto(s) por regularizar.</CardDescription>
          <Link href="/personal#adelantos-pendientes" className="mt-3 inline-flex">
            <Button type="button" variant="secondary">
              Ir a personal
            </Button>
          </Link>
        </Card>

        <Card>
          <CardTitle>Ventas por confirmar</CardTitle>
          <CardDescription className="mt-1">{ventasBorrador} venta(s) aún en borrador.</CardDescription>
          <Link href="/ventas#ventas-borrador" className="mt-3 inline-flex">
            <Button type="button" variant="secondary">
              Ir a ventas
            </Button>
          </Link>
        </Card>

        <Card>
          <CardTitle>Alertas críticas</CardTitle>
          <CardDescription className="mt-1">{alertasCriticas} alerta(s) de prioridad alta.</CardDescription>
          <Link href="/reportes/antifraude" className="mt-3 inline-flex">
            <Button type="button" variant="secondary">
              Abrir control socios
            </Button>
          </Link>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ingresos del período"
          value={formatPen(ingresosMesActual)}
          hint="Mes calendario actual (vista utilidad mensual, mismo criterio que Reportes)"
        />
        <MetricCard
          label="Egresos del período"
          value={formatPen(egresosMesActual)}
          hint="Egresos de caja del mes (utilidad mensual)"
        />
        <MetricCard label="Empleados activos" value={String(empleados.filter((e) => e.activo).length)} hint="Choferes y operarios habilitados" />
        <MetricCard label="Alertas operativas" value={String(alertas.length)} hint="Stock, deudas, penalidades y anomalías" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Movimientos de caja recientes</CardTitle>
          <CardDescription>Registro inalterable después del cierre mensual.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Fecha</TH>
                  <TH>Tipo</TH>
                  <TH>Categoría</TH>
                  <TH className="text-right">Monto</TH>
                </TRow>
              </THead>
              <tbody>
                {caja.slice(0, 5).map((row) => (
                  <TRow key={row.id}>
                    <TD>{formatDate(row.fecha)}</TD>
                    <TD>{row.tipo}</TD>
                    <TD>{row.categoria}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardTitle>Plan de acción de hoy</CardTitle>
          <CardDescription>Prioridades operativas con enlace directo al módulo responsable.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Acción</TH>
                  <TH>Detalle</TH>
                  <TH>Prioridad</TH>
                  <TH className="text-right">Ir</TH>
                </TRow>
              </THead>
              <tbody>
                {accionesHoy.map((row) => (
                  <TRow key={row.titulo}>
                    <TD className="font-semibold">{row.titulo}</TD>
                    <TD>{row.detalle}</TD>
                    <TD>{row.prioridad}</TD>
                    <TD className="text-right">
                      <Link href={row.href} className="text-xs font-semibold text-[var(--color-accent)] underline">
                        Abrir
                      </Link>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Ventas recientes</CardTitle>
          <CardDescription>{ventas.length} registros de madera encontrados.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Detalle</TH>
                </TRow>
              </THead>
              <tbody>
                {ventas.slice(0, 5).map((row) => (
                  <TRow key={row.id}>
                    <TD>{formatDate(row.fecha)}</TD>
                    <TD>{row.estado}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(row.total))}</TD>
                    <TD className="text-right">
                      <Link href="/ventas/madera-cortada" className="text-xs font-semibold text-[var(--color-accent)] underline">
                        Ver módulo
                      </Link>
                    </TD>
                  </TRow>
                ))}
                {ventas.length === 0 ? (
                  <TRow>
                    <TD colSpan={4} className="text-center text-[var(--color-text-secondary)]">
                      Aún no hay ventas registradas.
                    </TD>
                  </TRow>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card>
          <CardTitle>Alquileres recientes</CardTitle>
          <CardDescription>{alquileres.length} contratos en seguimiento.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Equipo</TH>
                  <TH>Inicio</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Tarifa</TH>
                </TRow>
              </THead>
              <tbody>
                {alquileres.slice(0, 5).map((row) => (
                  <TRow key={row.id}>
                    <TD className="font-semibold">{row.activo}</TD>
                    <TD>{formatDate(row.fecha_inicio)}</TD>
                    <TD>{row.estado}</TD>
                    <TD className="text-right">{formatPen(Number(row.tarifa))}</TD>
                  </TRow>
                ))}
                {alquileres.length === 0 ? (
                  <TRow>
                    <TD colSpan={4} className="text-center text-[var(--color-text-secondary)]">
                      Aún no hay alquileres registrados.
                    </TD>
                  </TRow>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <CardTitle>Utilidad mensual</CardTitle>
          <CardDescription>Vista gerencial consolidada desde todos los módulos.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Periodo</TH>
                  <TH className="text-right">Ingresos</TH>
                  <TH className="text-right">Egresos + Nómina</TH>
                  <TH className="text-right">Utilidad</TH>
                </TRow>
              </THead>
              <tbody>
                {utilidad.map((row) => (
                  <TRow key={`${row.anio}-${row.mes}`}>
                    <TD>{`${row.mes.toString().padStart(2, "0")}/${row.anio}`}</TD>
                    <TD className="text-right">{formatPen(Number(row.ingresos))}</TD>
                    <TD className="text-right">{formatPen(Number(row.egresos) + Number(row.sueldos))}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(row.utilidad_neta))}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>
    </div>
  );
}
