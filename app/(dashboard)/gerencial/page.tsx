import { redirect } from "next/navigation";
import Link from "next/link";
import { CashFlowChart } from "@/components/gerencial/cash-flow-chart";
import { MetricCard } from "@/components/metric-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { buildParetoInventarioRows } from "@/lib/inventario-pareto";
import { getDashboardSession } from "@/lib/current-user-role";
import {
  getCajaRows,
  getClientesRows,
  getCotizacionesRows,
  getCobrosVencidos,
  getCotizacionesUnificadasRows,
  getInventarioRobustoData,
  getOrdenesProduccionRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
  getAlquilerRows,
  getServiciosAserraderoRows,
} from "@/lib/data";
import { canAccessGerencial } from "@/lib/permissions";
import { deleteCliente, forzarEliminarClienteCompleto } from "@/app/actions";
import { formatDate, formatPen } from "@/lib/utils";
import { GerencialClienteSearchSelect } from "@/components/gerencial/cliente-search-select";
import { ClienteEstadoForm } from "@/components/gerencial/cliente-estado-form";
import { ClientesMasivoTable } from "@/components/gerencial/clientes-masivo-table";
import type { ClienteCompleto } from "@/lib/combobox-mocks";
import { CentroMandoTabs } from "@/components/gerencial/centro-mando-tabs";
import { AlertasBannerHoy } from "@/components/gerencial/alertas-banner-hoy";
import { InventarioTomaDecisionesCharts } from "@/components/inventario/inventario-toma-decisiones-charts";

export const dynamic = "force-dynamic";

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

function pct(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const value = ((current - previous) / previous) * 100;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

type GerencialPageProps = {
  searchParams?: Promise<{ cliente?: string | string[]; mensaje?: string | string[]; tab?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function GerencialPage({ searchParams }: GerencialPageProps) {
  const params = await searchParams;
  const session = await getDashboardSession();
  if (!canAccessGerencial(session?.role ?? null, session?.uiRole ?? null)) {
    redirect("/?mensaje=no-acceso");
  }

  const activeTab = firstParam(params?.tab) || "hoy";

  const [caja, inventario, cotizacionesUnificadas, cotizacionesMueble, cobros, ventasMuebles, ventasMadera, clientes, ordenes, alquilerBundle, servicios] = await Promise.all([
    getCajaRows(),
    getInventarioRobustoData(),
    getCotizacionesUnificadasRows(),
    getCotizacionesRows(),
    getCobrosVencidos(),
    getVentasMuebleTerminadoRows(),
    getVentasRows(),
    getClientesRows(),
    getOrdenesProduccionRows(),
    getAlquilerRows(),
    getServiciosAserraderoRows(),
  ]);

  const currentKey = monthKey();
  const prevKey = previousMonthKey();
  const cajaEmpresa = caja.filter((row) => !row.es_personal);
  const ingresosMes = cajaEmpresa.filter((row) => row.fecha.startsWith(currentKey) && row.tipo === "ingreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const ingresosPrev = cajaEmpresa.filter((row) => row.fecha.startsWith(prevKey) && row.tipo === "ingreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const egresosMes = cajaEmpresa.filter((row) => row.fecha.startsWith(currentKey) && row.tipo === "egreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const egresosPrev = cajaEmpresa.filter((row) => row.fecha.startsWith(prevKey) && row.tipo === "egreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const utilidad = ingresosMes - egresosMes;
  const cotPendientes = cotizacionesUnificadas.filter((row) => row.estado_flujo !== "cobrada");
  const totalCotPendientes = cotPendientes.reduce((acc, row) => acc + Number(row.total), 0);

  // Datos para "Hoy"
  const nowDate = new Date();
  const today = nowDate.toISOString().slice(0, 10);
  const yesterdayDate = new Date(nowDate);
  yesterdayDate.setDate(nowDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const ingresosHoy = cajaEmpresa.filter((r) => r.fecha === today && r.tipo === "ingreso").reduce((acc, r) => acc + Number(r.monto), 0);
  const ingresosAyer = cajaEmpresa.filter((r) => r.fecha === yesterday && r.tipo === "ingreso").reduce((acc, r) => acc + Number(r.monto), 0);

  const stockBajo = inventario.stockBajo.length;
  const ventasBorrador = ventasMadera.filter((v) => v.estado === "borrador").length;
  const alertasCriticas = cobros.length + inventario.stockBajo.length;

  const pendientesHoy = [
    stockBajo > 0 && { href: "/inventario?tab=alertas", texto: `Reponer stock: ${stockBajo} producto(s) por debajo del mínimo`, prioridad: "alta" as const },
    cobros.length > 0 && { href: "/reportes", texto: `Cobros vencidos: ${cobros.length} pendiente(s) de cobrar`, prioridad: "alta" as const },
    ventasBorrador > 0 && { href: "/ventas#ventas-borrador", texto: `Confirmar ${ventasBorrador} venta(s) en borrador`, prioridad: "media" as const },
    cotPendientes.length > 0 && { href: "/cotizacion", texto: `${cotPendientes.length} cotización(es) sin cerrar`, prioridad: "baja" as const },
  ].filter(Boolean) as Array<{ href: string; texto: string; prioridad: "alta" | "media" | "baja" }>;

  // Datos para "Pasado"
  const ventasMesProductos = inventario.rankingMasVendidos.slice(0, 3);

  // Pareto ABC para Centro de Mando
  const paretoData = buildParetoInventarioRows(inventario.productos, "unidades");
  const claseCount = { A: 0, B: 0, C: 0 };
  for (const r of paretoData.rows) claseCount[r.clase]++;
  const topABC = paretoData.rows.slice(0, 5);
  const totalPorCliente = new Map<string, number>();
  for (const row of ventasMuebles) totalPorCliente.set(row.cliente_id, (totalPorCliente.get(row.cliente_id) ?? 0) + Number(row.total));
  for (const row of ventasMadera) totalPorCliente.set(row.cliente_id, (totalPorCliente.get(row.cliente_id) ?? 0) + Number(row.total));
  const topClientes = [...totalPorCliente.entries()]
    .map(([clienteId, total]) => ({ cliente: clientes.find((c) => c.id === clienteId)?.nombre ?? "Cliente", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const alertasCriticasLista = [
    ...inventario.stockBajo.map((p) => `Stock bajo: ${p.nombre} (${p.stock_actual}/${p.stock_minimo})`),
    ...cobros.map((c) => `Cobro vencido: ${c.referencia} · ${formatPen(c.monto)}`),
    ...ordenes.filter((o) => o.estado !== "entregado").slice(0, 5).map((o) => `Orden sin entregar: ${o.correlativo ?? o.id.slice(0, 8)}`),
  ].slice(0, 12);

  const actividad = [...cajaEmpresa]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  const start30 = new Date();
  start30.setDate(start30.getDate() - 29);
  const points = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start30);
    d.setDate(start30.getDate() + i);
    const fecha = d.toISOString().slice(0, 10);
    const saldo = cajaEmpresa
      .filter((row) => row.fecha <= fecha)
      .reduce((acc, row) => acc + (row.tipo === "ingreso" ? Number(row.monto) : row.tipo === "egreso" ? -Number(row.monto) : 0), 0);
    return { fecha: fecha.slice(5), saldo: Number(saldo.toFixed(2)) };
  });

  // Datos "Clientes 360"
  const clientesCompleto: ClienteCompleto[] = clientes.map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento ?? null,
    telefono: (cliente as Record<string, unknown>).telefono as string | null ?? null,
    direccion: (cliente as Record<string, unknown>).direccion as string | null ?? null,
    ruc: (cliente as Record<string, unknown>).ruc as string | null ?? null,
  }));

  // Para la tabla masiva de clientes
  const clientesMasivo = clientes.map((cliente) => {
    const totalFacturado =
      ventasMuebles.filter((v) => v.cliente_id === cliente.id).reduce((a, v) => a + Number(v.total), 0) +
      ventasMadera.filter((v) => v.cliente_id === cliente.id).reduce((a, v) => a + Number(v.total), 0) +
      alquilerBundle.rows.filter((c) => c.cliente_id === cliente.id).reduce((a, c) => a + Number(c.monto_total ?? c.tarifa), 0) +
      servicios.filter((s) => s.cliente_id === cliente.id).reduce((a, s) => a + Number(s.precio_cobrado), 0);
    const totalOperaciones =
      cotizacionesUnificadas.filter((c) => c.cliente_id === cliente.id).length +
      ventasMuebles.filter((v) => v.cliente_id === cliente.id).length +
      ventasMadera.filter((v) => v.cliente_id === cliente.id).length;
    const cobrosVencidos = cobros.filter((c) => c.cliente_id === cliente.id).length;
    return {
      id: cliente.id,
      nombre: cliente.nombre,
      documento: cliente.documento ?? null,
      telefono: (cliente as Record<string, unknown>).telefono as string | null ?? null,
      estado: (cliente as Record<string, unknown>).estado as string | null ?? null,
      tipo_persona: (cliente as Record<string, unknown>).tipo_persona as string | null ?? null,
      totalFacturado,
      totalOperaciones,
      cobrosVencidos,
    };
  });

  const message = firstParam(params?.mensaje).trim();
  const selectedClienteId = firstParam(params?.cliente).trim();
  const selectedCliente = selectedClienteId ? clientes.find((c) => c.id === selectedClienteId) ?? null : null;
  const clienteCotizacionesUnificadas = selectedCliente ? cotizacionesUnificadas.filter((c) => c.cliente_id === selectedCliente.id) : [];
  const clienteCotizacionesMueble = selectedCliente ? cotizacionesMueble.filter((c) => c.cliente_id === selectedCliente.id) : [];
  const clienteVentasMuebles = selectedCliente ? ventasMuebles.filter((v) => v.cliente_id === selectedCliente.id) : [];
  const clienteVentasMadera = selectedCliente ? ventasMadera.filter((v) => v.cliente_id === selectedCliente.id) : [];
  const clienteContratos = selectedCliente ? alquilerBundle.rows.filter((c) => c.cliente_id === selectedCliente.id) : [];
  const clienteServicios = selectedCliente ? servicios.filter((s) => s.cliente_id === selectedCliente.id) : [];
  const clienteCobrosVencidos = selectedCliente ? cobros.filter((c) => c.cliente_id === selectedCliente.id) : [];
  const totalFacturadoCliente =
    clienteVentasMuebles.reduce((a, v) => a + Number(v.total), 0) +
    clienteVentasMadera.reduce((a, v) => a + Number(v.total), 0) +
    clienteContratos.reduce((a, c) => a + Number(c.monto_total ?? c.tarifa), 0) +
    clienteServicios.reduce((a, s) => a + Number(s.precio_cobrado), 0);
  const totalOperacionesCliente =
    clienteCotizacionesUnificadas.length +
    clienteCotizacionesMueble.length +
    clienteVentasMuebles.length +
    clienteVentasMadera.length +
    clienteContratos.length +
    clienteServicios.length;
  const relatedDependencies = [
    { label: "Cotizaciones de muebles", count: clienteCotizacionesMueble.length, href: "/ventas/muebles-personalizados" },
    { label: "Cotizaciones unificadas", count: clienteCotizacionesUnificadas.length, href: "/cotizacion" },
    { label: "Ventas de muebles terminados", count: clienteVentasMuebles.length, href: "/ventas/muebles-terminados" },
    { label: "Ventas de madera cortada", count: clienteVentasMadera.length, href: "/ventas/madera-cortada" },
    { label: "Contratos de alquiler", count: clienteContratos.length, href: "/ventas/alquiler-mixer" },
    { label: "Servicios de aserradero", count: clienteServicios.length, href: "/ventas/aserradero-servicios" },
    { label: "Cobros vencidos", count: clienteCobrosVencidos.length, href: "/reportes#cobros-vencidos" },
    { label: "Órdenes de producción", count: selectedCliente ? ordenes.filter((o) => o.cliente_id === selectedCliente.id).length : 0, href: "/ventas/muebles-personalizados" },
  ];
  const hasRelatedDependencies = relatedDependencies.some((dependency) => dependency.count > 0);
  const pedidosActivosCliente = selectedCliente
    ? ordenes.filter((o) => o.cliente_id === selectedCliente.id && o.estado !== "entregado" && o.estado !== "terminado").length
    : 0;
  const pagosPendientesCliente = selectedCliente ? clienteCobrosVencidos.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">
          Centro de Mando
        </h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Panel ejecutivo — indicadores en vivo desde todos los módulos.
        </p>
      </div>

      {message ? (
        <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-success)]/40 bg-[var(--katia-success)]/10 px-4 py-3 text-sm font-medium text-[var(--katia-success)]">
          ✓ {message}
        </div>
      ) : null}

      {/* Sub-tabs navegables */}
      <CentroMandoTabs activeTab={activeTab} />

      {/* ── HOY ── */}
      {activeTab === "hoy" ? (
        <div className="space-y-6">
          {/* Banner + pendientes priorizados con lógica seen/amarillo */}
          <Card>
            <CardTitle>Qué resolver hoy</CardTitle>
            <CardDescription>Acciones priorizadas. Haz clic para ir al módulo. Marca como revisado para cambiar a amarillo.</CardDescription>
            <div className="mt-4">
              <AlertasBannerHoy
                alertasCriticas={alertasCriticas}
                pendientesHoy={pendientesHoy}
              />
            </div>
          </Card>

          {/* KPI hero + gráfico tendencia */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card variant="hero" className="lg:col-span-2 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--katia-text-tertiary)]">
                  Ingresos de hoy
                </p>
                <p className="mt-2 font-mono text-4xl font-bold text-[var(--katia-text-primary)]">
                  {formatPen(ingresosHoy)}
                </p>
                <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
                  {ingresosAyer > 0
                    ? `${pct(ingresosHoy, ingresosAyer)} vs ayer (${formatPen(ingresosAyer)})`
                    : "Sin ingresos registrados ayer"}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--katia-border-subtle)] grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--katia-text-tertiary)]">Ingresos del mes</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--katia-text-primary)]">{formatPen(ingresosMes)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--katia-text-tertiary)]">Utilidad del mes</p>
                  <p className={`mt-0.5 font-mono text-sm font-semibold ${utilidad >= 0 ? "text-[var(--katia-success)]" : "text-[var(--katia-danger)]"}`}>{formatPen(utilidad)}</p>
                </div>
              </div>
            </Card>
            <Card className="lg:col-span-3">
              <CardTitle>Saldo acumulado — últimos 30 días</CardTitle>
              <CardDescription>Solo movimientos de empresa (sin personal).</CardDescription>
              <div className="mt-4">
                <CashFlowChart data={points} />
              </div>
            </Card>
          </div>

          {/* Lista de pendientes priorizados */}
          <Card>
            <CardTitle>Qué resolver hoy</CardTitle>
            <CardDescription>Máximo 5 acciones priorizadas. Si no hay nada, todo está bien.</CardDescription>
            {pendientesHoy.length === 0 ? (
              <div className="mt-4 rounded-[var(--katia-radius-md)] border border-[var(--katia-success)]/30 bg-[var(--katia-success)]/8 px-4 py-3 text-sm text-[var(--katia-success)]">
                Sin pendientes urgentes. ¡Todo bajo control!
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {pendientesHoy.map((item) => (
                  <div
                    key={item.href}
                    className="flex items-center justify-between gap-4 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] px-4 py-3 transition-colors hover:border-[var(--katia-border-emphasis)] hover:bg-[var(--katia-primary-soft)]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          item.prioridad === "alta"
                            ? "bg-[var(--katia-danger)]"
                            : item.prioridad === "media"
                            ? "bg-[var(--katia-warning)]"
                            : "bg-[var(--katia-text-tertiary)]"
                        }`}
                      />
                      <p className="text-sm text-[var(--katia-text-primary)]">{item.texto}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="shrink-0 text-xs font-semibold text-[var(--katia-primary)] hover:underline"
                    >
                      Abrir →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ABC compacto — resumen de clasificación de inventario */}
          {paretoData.rows.length > 0 ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Análisis ABC · inventario</CardTitle>
                  <CardDescription>Clasificación Pareto de productos por unidades vendidas.</CardDescription>
                </div>
                <Link href="/gerencial?tab=pasado" className="shrink-0 text-xs font-semibold text-[var(--katia-primary)] hover:underline">
                  Ver completo en Pasado →
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {(["A", "B", "C"] as const).map((clase) => (
                  <div key={clase} className={`flex-1 min-w-[80px] rounded-[var(--katia-radius-md)] border px-4 py-3 text-center ${
                    clase === "A"
                      ? "border-[var(--katia-success)]/30 bg-[var(--katia-success)]/8"
                      : clase === "B"
                      ? "border-[var(--katia-warning)]/30 bg-[var(--katia-warning)]/8"
                      : "border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)]"
                  }`}>
                    <p className="text-xs font-bold text-[var(--katia-text-tertiary)]">Clase {clase}</p>
                    <p className="mt-1 text-2xl font-black text-[var(--katia-text-primary)]">{claseCount[clase]}</p>
                    <p className="text-[10px] text-[var(--katia-text-tertiary)]">
                      {clase === "A" ? "foco" : clase === "B" ? "intermedio" : "revisar"}
                    </p>
                  </div>
                ))}
              </div>
              {topABC.length > 0 ? (
                <p className="mt-3 text-xs text-[var(--katia-text-tertiary)]">
                  Top producto: <span className="font-semibold text-[var(--katia-text-primary)]">{topABC[0].producto.nombre}</span>
                  {" "}({topABC[0].metric} u. · {topABC[0].pctAcum.toFixed(1)}% acum.)
                </p>
              ) : null}
            </Card>
          ) : null}

          {/* Atajos rápidos */}
          <Card>
            <CardTitle>Acciones rápidas</CardTitle>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/ventas">
                <Button type="button" size="sm">+ Nueva venta</Button>
              </Link>
              <Link href="/cotizacion">
                <Button type="button" variant="secondary" size="sm">+ Cotización</Button>
              </Link>
              <Link href="/ventas/clientes">
                <Button type="button" variant="secondary" size="sm">+ Cliente</Button>
              </Link>
              <Link href="/inventario?tab=productos">
                <Button type="button" variant="secondary" size="sm">+ Producto</Button>
              </Link>
              <Link href="/caja">
                <Button type="button" variant="ghost" size="sm">Abrir caja</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── PASADO ── */}
      {activeTab === "pasado" ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Ingresos del mes" value={formatPen(ingresosMes)} hint={`Vs mes anterior ${pct(ingresosMes, ingresosPrev)}`} />
            <MetricCard label="Egresos del mes" value={formatPen(egresosMes)} hint={`Vs mes anterior ${pct(egresosMes, egresosPrev)}`} />
            <MetricCard label="Utilidad neta" value={formatPen(utilidad)} hint="Ingresos − egresos de empresa" />
            <MetricCard label="Pendiente de cobro" value={formatPen(totalCotPendientes)} hint={`${cotPendientes.length} cotizaciones abiertas`} />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardTitle>Top 3 productos vendidos</CardTitle>
              <div className="mt-3 space-y-2">
                {ventasMesProductos.length > 0
                  ? ventasMesProductos.map((p) => (
                      <p key={p.id} className="text-sm text-[var(--katia-text-primary)]">
                        {p.nombre}:{" "}
                        <strong className="font-semibold">{p.vendido} u.</strong>
                      </p>
                    ))
                  : <p className="text-sm text-[var(--katia-text-secondary)]">Sin datos de ventas.</p>}
              </div>
            </Card>
            <Card>
              <CardTitle>Top 3 clientes</CardTitle>
              <div className="mt-3 space-y-2">
                {topClientes.length > 0
                  ? topClientes.map((c) => (
                      <p key={c.cliente} className="text-sm text-[var(--katia-text-primary)]">
                        {c.cliente}: <strong className="font-semibold">{formatPen(c.total)}</strong>
                      </p>
                    ))
                  : <p className="text-sm text-[var(--katia-text-secondary)]">Sin ventas por cliente.</p>}
              </div>
            </Card>
            <Card>
              <CardTitle>Alertas activas</CardTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {alertasCriticasLista.length > 0
                  ? alertasCriticasLista.map((item) => (
                      <li key={item} className="rounded-[var(--katia-radius-sm)] border border-[var(--katia-border-subtle)] px-3 py-2 text-[var(--katia-text-primary)]">
                        {item}
                      </li>
                    ))
                  : <li className="text-[var(--katia-text-secondary)]">Sin alertas activas.</li>}
              </ul>
            </Card>
          </section>

          {/* ABC / Pareto — gráficos completos */}
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--katia-text-primary)]">Análisis ABC · Pareto de inventario</h3>
                <p className="mt-0.5 text-sm text-[var(--katia-text-secondary)]">
                  Concentración de ventas por producto — criterio: unidades vendidas.
                </p>
              </div>
            </div>
            {paretoData.rows.length > 0 ? (
              <InventarioTomaDecisionesCharts
                rows={paretoData.rows}
                mode="unidades"
                totalMetric={paretoData.totalMetric}
              />
            ) : (
              <Card>
                <p className="py-6 text-center text-sm text-[var(--katia-text-secondary)]">
                  Sin datos de ventas para calcular el Pareto. Registra ventas en inventario primero.
                </p>
              </Card>
            )}
          </div>
                              ? "bg-[var(--katia-warning)]/15 text-[var(--katia-warning)]"
          <Card>
            <CardTitle>Flujo de caja — últimos 30 días</CardTitle>            <CardDescription>Saldo acumulado solo con movimientos de empresa.</CardDescription>
            <div className="mt-4">
              <CashFlowChart data={points} />
            </div>
          </Card>

          <Card>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Últimas 10 acciones observables desde Caja.</CardDescription>
            <div className="mt-3 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Registrado por</TH>
                    <TH>Tipo</TH>
                    <TH>Categoría</TH>
                    <TH>Fecha</TH>
                  </TRow>
                </THead>
                <tbody>
                  {actividad.map((row) => (
                    <TRow key={row.id}>
                      <TD>{row.created_by ?? "Sistema"}</TD>
                      <TD>{row.tipo}</TD>
                      <TD>{row.categoria}</TD>
                      <TD>{formatDate(row.created_at)}</TD>
                    </TRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── FUTURO ── */}
      {activeTab === "futuro" ? (
        <div className="space-y-6">
          <Card>
            <CardTitle>Cotizaciones por cerrar</CardTitle>
            <CardDescription>{cotPendientes.length} cotizaciones abiertas con un total de {formatPen(totalCotPendientes)}.</CardDescription>
            <div className="mt-4 overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
              <Table>
                <THead>
                  <TRow>
                    <TH>Correlativo</TH>
                    <TH>Cliente</TH>
                    <TH>Estado</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right">Ir</TH>
                  </TRow>
                </THead>
                <tbody>
                  {cotPendientes.slice(0, 10).map((row) => (
                    <TRow key={row.id}>
                      <TD className="font-mono text-xs">{row.correlativo ?? row.id.slice(0, 8)}</TD>
                      <TD>{clientes.find((c) => c.id === row.cliente_id)?.nombre ?? "—"}</TD>
                      <TD>{row.estado_flujo}</TD>
                      <TD className="text-right font-semibold">{formatPen(Number(row.total))}</TD>
                      <TD className="text-right">
                        <Link href={`/cotizacion?cotizacion=${row.id}`} className="text-xs font-semibold text-[var(--katia-primary)] hover:underline">
                          Abrir
                        </Link>
                      </TD>
                    </TRow>
                  ))}
                  {cotPendientes.length === 0 ? (
                    <TRow>
                      <TD colSpan={5} className="text-center text-[var(--katia-text-secondary)]">
                        Sin cotizaciones pendientes.
                      </TD>
                    </TRow>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card>
            <CardTitle>Stock valorizado</CardTitle>
            <MetricCard
              label="Valor del inventario"
              value={formatPen(inventario.indicadores.valorInventario)}
              hint={`${inventario.indicadores.totalProductosActivos} productos activos · ${stockBajo} con stock bajo`}
            />
          </Card>
        </div>
      ) : null}

      {/* ── CLIENTES 360 ── */}
      {activeTab === "clientes360" ? (
        <div className="space-y-6">
          {/* Tabla masiva de todos los clientes */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Gestión masiva de clientes</CardTitle>
                <CardDescription>
                  Todos los clientes con su historial, estado y acciones directas.
                  Selecciona uno para ver la ficha detallada.
                </CardDescription>
              </div>
              <Link href="/ventas/clientes">
                <button type="button" className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--katia-text-secondary)] hover:bg-[var(--katia-surface-raised)] transition-colors">
                  + Nuevo cliente
                </button>
              </Link>
            </div>
            <div className="mt-4">
              <ClientesMasivoTable
                clientes={clientesMasivo}
                isOwner={session?.role === "owner_admin"}
              />
            </div>
          </Card>

          {/* Ficha detallada de cliente seleccionado (via search select) */}
          <Card>
            <CardTitle>Ficha detallada — búsqueda rápida</CardTitle>
            <CardDescription>
              Busca un cliente específico para ver su resumen completo, cambiar estado o eliminarlo.
            </CardDescription>
            <div className="mt-4">
              <GerencialClienteSearchSelect
                clientes={clientesCompleto}
                value={selectedClienteId}
              />
            </div>
          </Card>

          {selectedCliente ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--katia-text-primary)]">{selectedCliente.nombre}</h3>
                  <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
                    {selectedCliente.tipo_persona === "empresa" ? "Empresa" : "Persona natural"} · {selectedCliente.documento ?? "Sin documento"}
                  </p>
                </div>
                <Link href={`/ventas/clientes/${selectedCliente.id}`}>
                  <Button variant="secondary" size="sm" type="button">Ver ficha completa →</Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--katia-text-tertiary)]">Desde</p>
                  <p className="mt-1 text-sm text-[var(--katia-text-primary)]">{formatDate(selectedCliente.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--katia-text-tertiary)]">Estado</p>
                  <p className="mt-1 text-sm text-[var(--katia-text-primary)]">{selectedCliente.estado ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--katia-text-tertiary)]">Cobros vencidos</p>
                  <p className={`mt-1 text-sm font-semibold ${pagosPendientesCliente > 0 ? "text-[var(--katia-danger)]" : "text-[var(--katia-text-primary)]"}`}>
                    {pagosPendientesCliente}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardTitle>Total facturado</CardTitle>
                  <p className="mt-1 font-mono text-2xl font-bold text-[var(--katia-text-primary)]">{formatPen(totalFacturadoCliente)}</p>
                </Card>
                <Card>
                  <CardTitle>Operaciones</CardTitle>
                  <p className="mt-1 text-2xl font-bold text-[var(--katia-text-primary)]">{totalOperacionesCliente}</p>
                </Card>
                <Card>
                  <CardTitle>Pedidos activos</CardTitle>
                  <p className="mt-1 text-2xl font-bold text-[var(--katia-text-primary)]">{pedidosActivosCliente}</p>
                </Card>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-overlay)] p-4">
                  <p className="text-sm font-semibold text-[var(--katia-text-primary)]">Datos de contacto</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--katia-text-secondary)]">
                    <p>Teléfono: {selectedCliente.telefono ?? "Sin teléfono"}</p>
                    <p>Dirección: {selectedCliente.direccion ?? "Sin dirección"}</p>
                    <p>Tipo: {selectedCliente.tipo_persona ?? "No definido"}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Card>
                    <CardTitle>Actualizar estado</CardTitle>
                    <CardDescription>Cambia el estado del cliente.</CardDescription>
                    <ClienteEstadoForm
                      clienteId={selectedCliente.id}
                      estadoActual={selectedCliente.estado ?? null}
                    />
                  </Card>
                </div>
              </div>

              {selectedCliente.estado !== "activo" ? (
                <div className="mt-6 rounded-[var(--katia-radius-md)] border border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/5 p-4">
                  <p className="text-sm font-semibold text-[var(--katia-danger)]">Eliminar cliente</p>
                  {hasRelatedDependencies ? (
                    <p className="mt-2 text-xs text-[var(--katia-text-secondary)]">
                      Este cliente tiene {relatedDependencies.filter((d) => d.count > 0).map((d) => `${d.count} ${d.label.toLowerCase()}`).join(", ")}. Limpia los registros relacionados antes de eliminar, o usa la opción de eliminación forzada (solo owner).
                    </p>
                  ) : (
                    <form action={deleteCliente} className="mt-4 grid gap-3">
                      <input type="hidden" name="id" value={selectedCliente.id} />
                      <Field
                        label="Escribe ELIMINAR CLIENTE para confirmar"
                        name="confirmacion"
                        placeholder="ELIMINAR CLIENTE"
                        required
                      />
                      <Button type="submit" variant="danger" size="sm">
                        Eliminar cliente
                      </Button>
                    </form>
                  )}
                  {session?.role === "owner_admin" && hasRelatedDependencies ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[var(--katia-danger)]">
                        Eliminar cliente y todos sus registros (owner_admin)
                      </summary>
                      <form action={forzarEliminarClienteCompleto} className="mt-3 grid gap-3">
                        <input type="hidden" name="id" value={selectedCliente.id} />
                        <Field
                          label="Escribe ELIMINAR TODO para confirmar"
                          name="confirmacion"
                          placeholder="ELIMINAR TODO"
                          required
                        />
                        <Button type="submit" variant="danger" size="sm">
                          Eliminar cliente y todos sus registros
                        </Button>
                      </form>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* ── HERRAMIENTAS ── */}
      {activeTab === "herramientas" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Herramientas rápidas</CardTitle>
            <CardDescription>Acciones directas sin entrar a cada módulo.</CardDescription>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Link href="/ventas">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Nueva venta directa</CardTitle>
                  <CardDescription className="mt-1">Registrar una venta rápida desde aquí.</CardDescription>
                </Card>
              </Link>
              <Link href="/cotizacion">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Nueva cotización</CardTitle>
                  <CardDescription className="mt-1">Crear cotización con líneas de productos.</CardDescription>
                </Card>
              </Link>
              <Link href="/inventario">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Ajuste de stock</CardTitle>
                  <CardDescription className="mt-1">Registrar entrada o salida de inventario.</CardDescription>
                </Card>
              </Link>
              <Link href="/caja">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Movimiento de caja</CardTitle>
                  <CardDescription className="mt-1">Registrar ingreso o egreso en caja.</CardDescription>
                </Card>
              </Link>
              <Link href="/reportes">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Reportes y exportes</CardTitle>
                  <CardDescription className="mt-1">Exportar data a Excel para análisis.</CardDescription>
                </Card>
              </Link>
              <Link href="/admin/respaldo">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Respaldo de datos</CardTitle>
                  <CardDescription className="mt-1">Descargar respaldo manual de la base de datos.</CardDescription>
                </Card>
              </Link>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
