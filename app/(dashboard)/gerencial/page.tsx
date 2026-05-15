import { redirect } from "next/navigation";
import Link from "next/link";
import { CashFlowChart } from "@/components/gerencial/cash-flow-chart";
import { MetricCard } from "@/components/metric-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
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
  getAlquilerRows,
  getServiciosAserraderoRows,
} from "@/lib/data";
import { canAccessGerencial } from "@/lib/permissions";
import { deleteCliente, updateClienteEstado } from "@/app/actions";
import { formatDate, formatPen } from "@/lib/utils";
import { GerencialClienteSearchSelect } from "@/components/gerencial/cliente-search-select";
import type { ClienteCompleto } from "@/lib/combobox-mocks";

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
  searchParams?: Promise<{ cliente?: string | string[] }>;
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

  const [caja, inventario, cotizaciones, cobros, ventasMuebles, ventasMadera, clientes, ordenes, alquilerBundle, servicios] = await Promise.all([
    getCajaRows(),
    getInventarioRobustoData(),
    getCotizacionesUnificadasRows(),
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

  const clientesCompleto: ClienteCompleto[] = clientes.map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento ?? null,
    telefono: (cliente as any).telefono ?? null,
    direccion: (cliente as any).direccion ?? null,
    ruc: (cliente as any).ruc ?? null,
  }));

  const selectedClienteId = firstParam(params?.cliente).trim();
  const selectedCliente = selectedClienteId ? clientes.find((c) => c.id === selectedClienteId) ?? null : null;
  const clienteCotizaciones = selectedCliente ? cotizaciones.filter((c) => c.cliente_id === selectedCliente.id) : [];
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
    clienteCotizaciones.length +
    clienteVentasMuebles.length +
    clienteVentasMadera.length +
    clienteContratos.length +
    clienteServicios.length;
  const relatedDependencies = [
    { label: "Cotizaciones de muebles", count: clienteCotizaciones.length, href: "/ventas/muebles-personalizados" },
    { label: "Ventas de muebles terminados", count: clienteVentasMuebles.length, href: "/ventas/muebles-terminados" },
    { label: "Ventas de madera cortada", count: clienteVentasMadera.length, href: "/ventas/madera-cortada" },
    { label: "Contratos de alquiler", count: clienteContratos.length, href: "/ventas/alquiler-mixer" },
    { label: "Servicios de aserradero", count: clienteServicios.length, href: "/ventas/aserradero-servicios" },
    { label: "Cobros vencidos", count: clienteCobrosVencidos.length, href: "/reportes#cobros-vencidos" },
  ];
  const hasRelatedDependencies = relatedDependencies.some((dependency) => dependency.count > 0);
  const pedidosActivosCliente = selectedCliente
    ? ordenes.filter((o) => o.cliente_id === selectedCliente.id && o.estado !== "entregado" && o.estado !== "terminado").length
    : 0;
  const pagosPendientesCliente = selectedCliente ? clienteCobrosVencidos.length : 0;

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
            Selecciona un cliente para ver su ficha completa, desactivarlo y eliminarlo con confirmación desde el panel gerencial.
          </CardDescription>
          <div className="mt-4">
            <GerencialClienteSearchSelect
              clientes={clientesCompleto}
              value={selectedClienteId}
            />
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Escribe el nombre, DNI, RUC o teléfono. Selecciona el cliente para cargar su ficha.
            </p>
          </div>
        </Card>
      </section>

      {selectedCliente ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedCliente.nombre}</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {selectedCliente.tipo_persona === "empresa" ? "Empresa" : "Persona natural"} · {selectedCliente.documento ?? "Sin documento"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/ventas/clientes/${selectedCliente.id}`}>
                  <Button variant="secondary">Ver en ventas</Button>
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Registrado desde</p>
                <p className="mt-1 text-sm text-[var(--color-text-primary)]">{formatDate(selectedCliente.created_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Estado</p>
                <p className="mt-1 text-sm text-[var(--color-text-primary)]">{selectedCliente.estado ?? "desconocido"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Pagos pendientes</p>
                <p className="mt-1 text-sm text-[var(--color-text-primary)]">{pagosPendientesCliente}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Card className="col-span-1 rounded-xl border border-[var(--border-color)]">
                <CardTitle>Total facturado</CardTitle>
                <CardDescription>{formatPen(totalFacturadoCliente)}</CardDescription>
              </Card>
              <Card className="col-span-1 rounded-xl border border-[var(--border-color)]">
                <CardTitle>Operaciones</CardTitle>
                <CardDescription>{totalOperacionesCliente} registros</CardDescription>
              </Card>
              <Card className="col-span-1 rounded-xl border border-[var(--border-color)]">
                <CardTitle>Pedidos activos</CardTitle>
                <CardDescription>{pedidosActivosCliente}</CardDescription>
              </Card>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                <p className="text-sm font-semibold">Detalles</p>
                <div className="mt-3 space-y-2 text-sm text-[var(--color-text-primary)]">
                  <p>Teléfono: {selectedCliente.telefono ?? "Sin teléfono"}</p>
                  <p>Dirección: {selectedCliente.direccion ?? "Sin dirección"}</p>
                  <p>Tipo: {selectedCliente.tipo_persona ?? "No definido"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <Card className="rounded-xl border border-[var(--border-color)] p-4">
                  <CardTitle>Actualizar estado</CardTitle>
                  <CardDescription>
                    Cambia el estado del cliente antes de usar la opción de eliminar.
                  </CardDescription>
                  <form action={updateClienteEstado} className="mt-4 grid gap-3">
                    <input type="hidden" name="id" value={selectedCliente.id} />
                    <select
                      name="estado"
                      defaultValue={selectedCliente.estado ?? "activo"}
                      className="h-11 w-full rounded-[var(--border-radius-input)] border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] outline-none ring-0 transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)]"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="moroso">Moroso</option>
                    </select>
                    <Button type="submit">Guardar estado</Button>
                  </form>
                </Card>

                <Card className="rounded-xl border border-[var(--border-color)] p-4">
                  <CardTitle>Eliminar cliente</CardTitle>
                  <CardDescription>
                    Solo disponible si el cliente está desactivado o moroso. La eliminación es irreversible.
                  </CardDescription>
                  {selectedCliente.estado === "activo" ? (
                    <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                      Desactiva primero al cliente para habilitar la eliminación.
                    </p>
                  ) : hasRelatedDependencies ? (
                    <div className="mt-4 space-y-4">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Este cliente aún tiene registros relacionados. Elimina o cierra estos datos antes de borrar el cliente:
                      </p>
                      <div className="grid gap-3">
                        {relatedDependencies.map((dependency) =>
                          dependency.count > 0 ? (
                            <div key={dependency.label} className="rounded-xl border border-[var(--border-color)] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{dependency.label}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">
                                    {dependency.count} registro{dependency.count === 1 ? "" : "s"}
                                  </p>
                                </div>
                                <Link href={dependency.href} className="text-sm font-semibold text-[var(--color-accent)] underline">
                                  Revisar
                                </Link>
                              </div>
                            </div>
                          ) : null,
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Luego de limpiar los datos relacionados, vuelve aquí para eliminar el cliente.
                      </p>
                    </div>
                  ) : (
                    <form action={deleteCliente} className="mt-4 grid gap-3">
                      <input type="hidden" name="id" value={selectedCliente.id} />
                      <Field
                        label="Escribe ELIMINAR CLIENTE para confirmar"
                        name="confirmacion"
                        placeholder="ELIMINAR CLIENTE"
                        required
                      />
                      <Button type="submit" variant="danger">
                        Eliminar cliente
                      </Button>
                    </form>
                  )}
                </Card>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

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
