import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { UrgenciasPanel } from "@/components/inicio/urgencias-panel";
import { ReintentarButton } from "@/components/inicio/reintentar-button";
import { getInicioData, INICIO_SECTION_LABELS, type InicioValues } from "@/lib/inicio-data";
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
  const [inicio, empresa] = await Promise.all([
    getInicioData(),
    getEmpresaConfig().catch(() => null),
  ]);
  const caja = inicio.caja.data ?? [];
  const ventas = inicio.ventas.data ?? [];
  const stockBajo = inicio.inventario.data?.stockBajo ?? 0;
  const ventasBorrador = inicio.ventasBorrador.data ?? 0;
  const penalidadesActivas = inicio.penalidadesActivas.data ?? 0;
  const adelantosPendientes = inicio.adelantosPendientes.data ?? 0;
  const alertasCriticas = inicio.alertasCriticas.data ?? 0;
  const unavailable = (Object.keys(inicio) as (keyof InicioValues)[])
    .filter((key) => !inicio[key].available).map((key) => INICIO_SECTION_LABELS[key]);
  const verified = unavailable.length === 0;
  const mes = inicio.mes.data;
  const utilidad = mes ? mes.ingresos - mes.egresos : null;
  const monthLabel = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", month: "long", year: "numeric",
  }).format(new Date());

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
      href: "/gerencial?alertas=criticas",
      cta: "Abrir Centro de Mando",
      count: alertasCriticas,
    },
    ventasBorrador > 0 && {
      key: "ventas",
      titulo: "Ventas sin confirmar",
      detalle: `${ventasBorrador} venta(s) aún en borrador`,
      href: "/ventas?estado=borrador",
      cta: "Ver ventas sin confirmar",
      count: ventasBorrador,
    },
    penalidadesActivas > 0 && {
      key: "penalidades",
      titulo: "Penalidades activas",
      detalle: `${penalidadesActivas} contrato(s) con penalidad`,
      href: "/ventas/alquiler-mixer?penalidades=activas#contratos-registrados",
      cta: "Revisar contratos",
      count: penalidadesActivas,
    },
    adelantosPendientes > 0 && {
      key: "adelantos",
      titulo: "Adelantos pendientes",
      detalle: `${adelantosPendientes} adelanto(s) por regularizar`,
      href: "/personal?adelantos=pendiente#adelantos-pendientes",
      cta: "Ver adelantos pendientes",
      count: adelantosPendientes,
    },
  ].filter(Boolean) as Array<{ key: string; titulo: string; detalle: string; href: string; cta: string; count: number }>;

  const statusMessage = !verified
    ? urgencias.length > 0
      ? "Hay pendientes y parte de la información aún no pudo verificarse."
      : "No se pudo verificar si todo está al día."
    : urgencias.length > 0
      ? "Hay elementos que requieren tu atención."
      : "Todo bajo control. No hay pendientes en las categorías verificadas.";

  return (
    <div className="space-y-6">
      {/* Errores y acceso denegado */}
      {mensaje === "no-acceso" ? (
        <Card className="border-[var(--katia-danger)]/40 bg-[var(--katia-danger)]/5">
          <CardTitle className="text-[var(--katia-danger)]">No tienes acceso a esta sección</CardTitle>
          <CardDescription>Tu rol no tiene permisos para el módulo solicitado.</CardDescription>
        </Card>
      ) : null}
      {/* Checklist de primeros pasos (solo si hay pasos sin completar) */}
      {inicio.inventario.available && inicio.clientes.available && inicio.cotizaciones.available && empresa ? <OnboardingBanner
        steps={[
          { label: "Configura empresa", done: Boolean(empresa?.nombre), href: "/configuracion" },
          { label: "Agrega productos", done: inicio.inventario.data.total > 0, href: "/inventario?tab=productos" },
          { label: "Registra cliente", done: inicio.clientes.data > 0, href: "/ventas/clientes" },
          { label: "Crea cotización", done: inicio.cotizaciones.data > 0, href: "/cotizacion" },
        ]}
      /> : null}

      {/* ── ZONA CRÍTICA: lo más importante primero ── */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Inicio</h2>
            <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
              {statusMessage}
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

      {!verified ? (
        <Card className="border-[var(--katia-warning)]/40 bg-[var(--katia-warning)]/5">
          <div className="flex flex-wrap items-center justify-between gap-4" role="status">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-[var(--katia-warning)]">Verificación incompleta</CardTitle>
              <CardDescription className="mt-2">
                No se pudo cargar: {unavailable.join(", ")}. Los datos disponibles se muestran abajo.
              </CardDescription>
            </div>
            <ReintentarButton />
          </div>
        </Card>
      ) : null}

      {/* Urgencias — visible y prominentes solo si existen */}
      <UrgenciasPanel urgencias={urgencias} verified={verified} />

      {/* ── MÉTRICAS DEL PERÍODO (secundario) ── */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--katia-text-tertiary)]">{monthLabel}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Ingresos del mes</p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--katia-text-primary)]">{mes ? formatPen(mes.ingresos) : "No disponible"}</p>
          </div>
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Egresos del mes</p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--katia-text-primary)]">{mes ? formatPen(mes.egresos) : "No disponible"}</p>
          </div>
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Utilidad estimada</p>
            <p className={`mt-1 font-mono text-lg font-bold ${utilidad === null ? "text-[var(--katia-text-secondary)]" : utilidad >= 0 ? "text-[var(--katia-success)]" : "text-[var(--katia-danger)]"}`}>
              {utilidad === null ? "No disponible" : formatPen(utilidad)}
            </p>
          </div>
          <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3">
            <p className="text-xs text-[var(--katia-text-tertiary)]">Empleados activos</p>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--katia-text-primary)]">
              {inicio.empleadosActivos.data ?? "No disponible"}
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
                      {inicio.caja.available ? <>Sin movimientos aún.{" "}
                        <Link href="/caja" className="text-[var(--katia-primary)] hover:underline">Ir a caja</Link>
                      </> : "No se pudieron cargar los movimientos de caja."}
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
          <CardDescription>Últimas ventas de madera registradas.</CardDescription>
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
                      {inicio.ventas.available ? <>Sin ventas aún.{" "}
                        <Link href="/ventas" className="text-[var(--katia-primary)] hover:underline">Registrar venta</Link>
                      </> : "No se pudieron cargar las ventas recientes."}
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
