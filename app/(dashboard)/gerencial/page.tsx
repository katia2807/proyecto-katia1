import { redirect } from "next/navigation";
import Link from "next/link";
import { CashFlowChart } from "@/components/gerencial/cash-flow-chart";
import { MetricCard } from "@/components/metric-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getDashboardSession } from "@/lib/current-user-role";
import {
  getCajaRows,
  getClientesRows,
  getCobrosVencidos,
  getCotizacionesUnificadasRows,
  getInventarioRobustoData,
  getOrdenesProduccionRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
} from "@/lib/data";
import { canAccessGerencial } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

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

export default async function GerencialPage() {
  const session = await getDashboardSession();
  if (!canAccessGerencial(session?.role ?? null, session?.uiRole ?? null)) {
    redirect("/?mensaje=no-acceso");
  }

  const [caja, inventario, cotizaciones, cobros, ventasMuebles, ventasMadera, clientes, ordenes] = await Promise.all([
    getCajaRows(),
    getInventarioRobustoData(),
    getCotizacionesUnificadasRows(),
    getCobrosVencidos(),
    getVentasMuebleTerminadoRows(),
    getVentasRows(),
    getClientesRows(),
    getOrdenesProduccionRows(),
  ]);

  const currentKey = monthKey();
  const prevKey = previousMonthKey();
  const cajaEmpresa = caja.filter((row) => !row.es_personal);
  const ingresosMes = cajaEmpresa.filter((row) => row.fecha.startsWith(currentKey) && row.tipo === "ingreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const ingresosPrev = cajaEmpresa.filter((row) => row.fecha.startsWith(prevKey) && row.tipo === "ingreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const egresosMes = cajaEmpresa.filter((row) => row.fecha.startsWith(currentKey) && row.tipo === "egreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const egresosPrev = cajaEmpresa.filter((row) => row.fecha.startsWith(prevKey) && row.tipo === "egreso").reduce((acc, row) => acc + Number(row.monto), 0);
  const utilidad = ingresosMes - egresosMes;
  const cotPendientes = cotizaciones.filter((row) => row.estado_flujo !== "cobrada");
  const totalCotPendientes = cotPendientes.reduce((acc, row) => acc + Number(row.total), 0);

  const ventasMesProductos = inventario.rankingMasVendidos.slice(0, 3);
  const totalPorCliente = new Map<string, number>();
  for (const row of ventasMuebles) totalPorCliente.set(row.cliente_id, (totalPorCliente.get(row.cliente_id) ?? 0) + Number(row.total));
  for (const row of ventasMadera) totalPorCliente.set(row.cliente_id, (totalPorCliente.get(row.cliente_id) ?? 0) + Number(row.total));
  const topClientes = [...totalPorCliente.entries()]
    .map(([clienteId, total]) => ({ cliente: clientes.find((c) => c.id === clienteId)?.nombre ?? "Cliente", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

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

  const alertasCriticas = [
    ...inventario.stockBajo.map((p) => `Stock bajo: ${p.nombre} (${p.stock_actual}/${p.stock_minimo})`),
    ...cobros.map((c) => `Cobro vencido: ${c.referencia} · ${formatPen(c.monto)}`),
    ...ordenes.filter((o) => o.estado !== "entregado").map((o) => `Orden sin entregar: ${o.correlativo ?? o.id.slice(0, 8)}`),
  ].slice(0, 12);
  const actividad = [...cajaEmpresa]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Panel Gerencial</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Indicadores ejecutivos calculados en vivo desde Supabase y los datos operativos del sistema.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Ingresos del mes" value={formatPen(ingresosMes)} hint={`Vs mes anterior ${pct(ingresosMes, ingresosPrev)}`} />
        <MetricCard label="Egresos del mes" value={formatPen(egresosMes)} hint={`Vs mes anterior ${pct(egresosMes, egresosPrev)}`} />
        <MetricCard label="Utilidad neta real" value={formatPen(utilidad)} hint="Ingresos - egresos de empresa" />
        <MetricCard label="Pendiente de cobro" value={formatPen(totalCotPendientes)} hint={`${cotPendientes.length} cotizaciones abiertas`} />
        <MetricCard label="Stock valorizado" value={formatPen(inventario.indicadores.valorInventario)} hint={`${inventario.indicadores.totalProductosActivos} productos activos`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-3">
          <CardTitle>Gestión de clientes</CardTitle>
          <CardDescription>
            Abre la lista completa de clientes para ver detalles 360, pedidos activos y pagos pendientes desde el panel gerencial.
          </CardDescription>
          <div className="mt-4">
            <Link href="/ventas/clientes">
              <Button variant="secondary">Abrir gestión de clientes</Button>
            </Link>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Flujo de caja ultimos 30 dias</CardTitle>
          <CardDescription>Saldo acumulado solo con movimientos de empresa.</CardDescription>
          <div className="mt-4">
            <CashFlowChart data={points} />
          </div>
        </Card>
        <Card>
          <CardTitle>Alertas criticas</CardTitle>
          <CardDescription>Stock bajo, cobros vencidos y ordenes sin entregar.</CardDescription>
          <ul className="mt-4 space-y-2 text-sm">
            {alertasCriticas.length > 0 ? alertasCriticas.map((item) => <li key={item} className="rounded-lg border border-[var(--color-border)] p-3">{item}</li>) : <li className="text-[var(--color-text-secondary)]">No hay alertas criticas con los datos actuales.</li>}
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardTitle>Top 3 productos vendidos</CardTitle>
          <div className="mt-3 space-y-2">
            {ventasMesProductos.length > 0 ? ventasMesProductos.map((p) => <p key={p.id} className="text-sm">{p.nombre}: <strong>{p.vendido}</strong></p>) : <p className="text-sm text-[var(--color-text-secondary)]">Sin ventas de productos.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle>Top 3 clientes</CardTitle>
          <div className="mt-3 space-y-2">
            {topClientes.length > 0 ? topClientes.map((c) => <p key={c.cliente} className="text-sm">{c.cliente}: <strong>{formatPen(c.total)}</strong></p>) : <p className="text-sm text-[var(--color-text-secondary)]">Sin ventas por cliente.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle>Log de actividad</CardTitle>
          <CardDescription>Ultimas 10 acciones observables desde Caja.</CardDescription>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Usuario</TH>
                  <TH>Accion</TH>
                  <TH>Hora</TH>
                </TRow>
              </THead>
              <tbody>
                {actividad.map((row) => (
                  <TRow key={row.id}>
                    <TD>{row.created_by ?? "Sistema"}</TD>
                    <TD>{row.tipo} {row.categoria}</TD>
                    <TD>{formatDate(row.created_at)}</TD>
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
