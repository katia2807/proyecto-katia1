import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
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

  const { caja, ventas, alquileres, empleados, alertas, ingresosMesActual, egresosMesActual } = snapshot;

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

  // Calcular urgencias para jerarquía visual
  const urgencias = [
    stockBajo > 0 && {
      key: "stock",
      titulo: "Stock por reponer",
      detalle: `${stockBajo} producto(s) por debajo del mínimo`,
      href: "/inventario?tab=alertas#alertas-stock",
      cta: "Ver alertas de stock",
      count: stockBajo,
    },
    alertasCriticas > 0 && {
      key: "alertas",
      titulo: "Alertas críticas",
      detalle: `${alertasCriticas} alerta(s) de prioridad alta`,
      href: "/gerencial",
      cta: "Abrir Centro de Mando",
      count: alertasCriticas,
    },
    ventasBorrador > 0 && {
      key: "ventas",
      titulo: "Ventas sin confirmar",
      detalle: `${ventasBorrador} venta(s) aún en borrador`,
      href: "/ventas",
      cta: "Ir a ventas",
      count: ventasBorrador,
    },
    penalidadesActivas > 0 && {
      key: "penalidades",
      titulo: "Penalidades activas",
      detalle: `${penalidadesActivas} contrato(s) con penalidad`,
      href: "/ventas/alquiler-mixer",
      cta: "Revisar contratos",
      count: penalidadesActivas,
    },
    adelantosPendientes > 0 && {
      key: "adelantos",
      titulo: "Adelantos pendientes",
      detalle: `${adelantosPendientes} adelanto(s) por regularizar`,
      href: "/personal",
      cta: "Ir a personal",
      count: adelantosPendientes,
    },
  ].filter(Boolean) as Array<{ key: string; titulo: string; detalle: string; href: string; cta: string; count: number }>;

  const todoOk = urgencias.length === 0;

  return (
    <div className="space-y-6">
      {/* Errores y acceso denegado */}
      {mensaje === "no-acceso" ? (
        <Card className="border-[var(--katia-danger)]/40 bg-[var(--katia-danger)]/5">
          <CardTitle className="text-[var(--katia-danger)]">No tienes acceso a esta sección</CardTitle>
          <CardDescription>Tu rol no tiene permisos para el módulo solicitado.</CardDescription>
        </Card>
      ) : null}
      {dashboardLoadError ? (
        <Card className="border-[var(--katia-danger)]/40 bg-[var(--katia-danger)]/5">
          <CardTitle className="text-[var(--katia-danger)]">Error al cargar datos</CardTitle>
          <CardDescription className="mt-2">{dashboardLoadError}</CardDescription>
        </Card>
      ) : null}

      {/* Checklist de primeros pasos (solo si hay pasos sin completar) */}
      <OnboardingBanner
        steps={[
          { label: "Configura empresa", done: Boolean(empresa?.nombre), href: "/configuracion" },
          { label: "Agrega productos", done: inventario.productos.length > 0, href: "/inventario?tab=productos" },
          { label: "Registra cliente", done: clientes.length > 0, href: "/ventas/clientes" },
          { label: "Crea cotizacion", done: cotizaciones.length > 0, href: "/cotizacion" },
        ]}
      />

      {/* ── ZONA CRÍTICA: lo más importante primero ── */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Inicio</h2>
            <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
              {todoOk ? "Todo bajo control. No hay urgencias hoy." : "Hay elementos que requieren tu atención."}
            </p>
          </div>
          <Link
            href="/gerencial"
            className="shrink-0 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--katia-text-secondary)] hover:bg-[var(--katia-surface-raised)] transition-colors"
          >
            Panel ejecutivo →
          </Link>
        </div>
      </div>

      {/* Urgencias — visible y prominentes solo si existen */}
      {urgencias.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {urgencias.map((u) => (
            <Link key={u.key} href={u.href} className="group block">
              <div className="h-full rounded-[var(--katia-radius-lg)] border border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/5 p-4 transition-colors hover:border-[var(--katia-danger)]/60 hover:bg-[var(--katia-danger)]/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--katia-text-primary)]">{u.titulo}</p>
                    <p className="mt-0.5 text-xs text-[var(--katia-text-secondary)]">{u.detalle}</p>
                  </div>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--katia-danger)] text-xs font-bold text-white">
                    {u.count}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold text-[var(--katia-danger)] group-hover:underline">
                  {u.cta} →
                </p>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-[var(--katia-radius-lg)] border border-[var(--katia-success)]/30 bg-[var(--katia-success)]/8 px-5 py-4 flex items-center gap-3">
          <span className="text-xl">✓</span>
          <div>
            <p className="text-sm font-semibold text-[var(--katia-success)]">Sin urgencias hoy</p>
            <p className="text-xs text-[var(--katia-text-secondary)]">Stock, cobros, ventas y personal están al día.</p>
          </div>
          <Link href="/gerencial" className="ml-auto text-xs font-semibold text-[var(--katia-primary)] hover:underline shrink-0">
            Ver análisis completo →
          </Link>
        </div>
      )}

      {/* ── MÉTRICAS DEL PERÍODO (secundario) ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--katia-text-tertiary)]">Este período</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Ingresos del mes</p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--katia-text-primary)]">{formatPen(ingresosMesActual)}</p>
          </div>
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Egresos del mes</p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--katia-text-primary)]">{formatPen(egresosMesActual)}</p>
          </div>
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Utilidad estimada</p>
            <p className={`mt-1 font-mono text-lg font-bold ${ingresosMesActual - egresosMesActual >= 0 ? "text-[var(--katia-success)]" : "text-[var(--katia-danger)]"}`}>
              {formatPen(ingresosMesActual - egresosMesActual)}
            </p>
          </div>
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Empleados activos</p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--katia-text-primary)]">
              {empleados.filter((e) => e.activo).length}
            </p>
          </div>
        </div>
        <p className="mt-2 text-right text-xs text-[var(--katia-text-tertiary)]">
          <Link href="/gerencial?tab=pasado" className="hover:text-[var(--katia-primary)] hover:underline">
            Ver análisis detallado en Centro de Mando →
          </Link>
        </p>
      </section>

      {/* ── ACTIVIDAD RECIENTE (compacto) ── */}
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Caja reciente</CardTitle>
            <Link href="/caja" className="text-xs font-semibold text-[var(--katia-primary)] hover:underline">
              Ver todos →
            </Link>
          </div>
          <CardDescription>Últimos movimientos registrados.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
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
                {caja.slice(0, 4).map((row) => (
                  <TRow key={row.id}>
                    <TD>{formatDate(row.fecha)}</TD>
                    <TD>
                      <span className={`text-xs font-medium ${row.tipo === "ingreso" ? "text-[var(--katia-success)]" : "text-[var(--katia-danger)]"}`}>
                        {row.tipo}
                      </span>
                    </TD>
                    <TD className="text-xs">{row.categoria}</TD>
                    <TD className="text-right font-mono font-semibold">{formatPen(Number(row.monto))}</TD>
                  </TRow>
                ))}
                {caja.length === 0 ? (
                  <TRow>
                    <TD colSpan={4} className="text-center text-xs text-[var(--katia-text-tertiary)]">
                      Sin movimientos aún.{" "}
                      <Link href="/caja" className="text-[var(--katia-primary)] hover:underline">
                        Ir a caja
                      </Link>
                    </TD>
                  </TRow>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Ventas recientes</CardTitle>
            <Link href="/ventas" className="text-xs font-semibold text-[var(--katia-primary)] hover:underline">
              Ver todas →
            </Link>
          </div>
          <CardDescription>{ventas.length} venta(s) de madera registradas.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Ir</TH>
                </TRow>
              </THead>
              <tbody>
                {ventas.slice(0, 4).map((row) => (
                  <TRow key={row.id}>
                    <TD>{formatDate(row.fecha)}</TD>
                    <TD>
                      <span className={`text-xs font-medium ${row.estado === "borrador" ? "text-[var(--katia-warning)]" : "text-[var(--katia-success)]"}`}>
                        {row.estado}
                      </span>
                    </TD>
                    <TD className="text-right font-mono font-semibold">{formatPen(Number(row.total))}</TD>
                    <TD className="text-right">
                      <Link href="/ventas/madera-cortada" className="text-xs text-[var(--katia-primary)] hover:underline">
                        Abrir
                      </Link>
                    </TD>
                  </TRow>
                ))}
                {ventas.length === 0 ? (
                  <TRow>
                    <TD colSpan={4} className="text-center text-xs text-[var(--katia-text-tertiary)]">
                      Sin ventas aún.{" "}
                      <Link href="/ventas" className="text-[var(--katia-primary)] hover:underline">
                        Registrar venta
                      </Link>
                    </TD>
                  </TRow>
                ) : null}
              </tbody>
            </Table>
          </div>
        </Card>
      </section>

      {/* ── ACCESOS RÁPIDOS (lo menos importante, muy discreto) ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--katia-text-tertiary)]">Accesos rápidos</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/cotizacion">
            <Button type="button" variant="secondary" size="sm">Nueva cotización</Button>
          </Link>
          <Link href="/ventas/clientes">
            <Button type="button" variant="secondary" size="sm">Ver clientes</Button>
          </Link>
          <Link href="/inventario?tab=productos">
            <Button type="button" variant="secondary" size="sm">Catálogo</Button>
          </Link>
          <Link href="/reportes">
            <Button type="button" variant="ghost" size="sm">Exportar reportes</Button>
          </Link>
          <Link href="/gerencial">
            <Button type="button" variant="ghost" size="sm">Centro de Mando</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
