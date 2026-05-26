import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import {
  getAlquilerRows,
  getClientesRows,
  getCobrosVencidos,
  getCotizacionesRows,
  getCotizacionesUnificadasRows,
  getMueblesCatalogoRows,
  getOrdenesProduccionRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
} from "@/lib/data";
import { formatPen } from "@/lib/utils";
import { computeEconomiaInterna } from "@/lib/cotizacion-calculos";


function inMes(fecha: string, anio: number, mes: number) {
  const d = new Date(fecha);
  return d.getFullYear() === anio && d.getMonth() + 1 === mes;
}

export default async function VentasDashboardPage() {
  const today = new Date();
  const anio = today.getFullYear();
  const mes = today.getMonth() + 1;
  const periodoLabel = `${String(mes).padStart(2, "0")}/${anio}`;

  const [
    ventasMuebles,
    ordenes,
    ventasMadera,
    alquilerBundle,
    aserradero,
    cotizaciones,
    cotizacionesUnificadas,
    catalogo,
    clientes,
    cobrosVencidos,
  ] = await Promise.all([
    getVentasMuebleTerminadoRows(),
    getOrdenesProduccionRows(),
    getVentasRows(),
    getAlquilerRows(),
    getServiciosAserraderoRows(),
    getCotizacionesRows(),
    getCotizacionesUnificadasRows(),
    getMueblesCatalogoRows(),
    getClientesRows(),
    getCobrosVencidos(),
  ]);

  const contratos = alquilerBundle.rows;

  const muebleById = new Map(catalogo.map((m) => [m.id, m]));
  const clienteById = new Map(clientes.map((c) => [c.id, c]));

  const ventasMueblesMes = ventasMuebles.filter((v) => inMes(v.fecha, anio, mes));
  const ventasMaderaMes = ventasMadera.filter((v) => inMes(v.fecha, anio, mes));
  const contratosMes = contratos.filter((c) => inMes(c.fecha_inicio, anio, mes));
  const aserraderoMes = aserradero.filter((s) => inMes(s.fecha, anio, mes));
  const cotizacionesMes = cotizaciones.filter((c) => inMes(c.fecha, anio, mes));
  const ordenesActivas = ordenes.filter((o) => o.estado !== "entregado");

  const ingresoMuebles = ventasMueblesMes.reduce((acc, v) => acc + Number(v.total), 0);
  const ingresoMadera = ventasMaderaMes.reduce((acc, v) => acc + Number(v.total), 0);
  const ingresoAlquiler = contratosMes.reduce(
    (acc, c) => acc + Number(c.monto_total ?? c.tarifa),
    0,
  );
  const ingresoAserradero = aserraderoMes.reduce(
    (acc, s) => acc + Number(s.precio_cobrado),
    0,
  );
  const ingresoTotalMes =
    ingresoMuebles + ingresoMadera + ingresoAlquiler + ingresoAserradero;

  const totalVentasMes =
    ventasMueblesMes.length +
    ventasMaderaMes.length +
    contratosMes.length +
    aserraderoMes.length;

  const cotizacionesUnificadasMes = cotizacionesUnificadas.filter((c) => inMes(c.fecha, anio, mes));

  const margenesClasicos = cotizacionesMes
    .map((c) => {
      const total = Number(c.precio_acordado);
      const costo = Number(c.costo_estimado ?? 0);
      if (total <= 0) return null;
      return ((total - costo) / total) * 100;
    })
    .filter((x): x is number => x != null);

  const margenesUnificados = cotizacionesUnificadasMes
    .map((c) => {
      const econ = computeEconomiaInterna(c.detalle as any);
      return econ.margenPct;
    })
    .filter((x): x is number => x != null);

  const margenes = [...margenesClasicos, ...margenesUnificados];

  const margenPromedio = margenes.length > 0
    ? margenes.reduce((a, b) => a + b, 0) / margenes.length
    : 0;


  const muebleVentas = new Map<string, { qty: number; ingreso: number }>();
  for (const v of ventasMueblesMes) {
    const prev = muebleVentas.get(v.mueble_catalogo_id) ?? { qty: 0, ingreso: 0 };
    prev.qty += Number(v.cantidad);
    prev.ingreso += Number(v.total);
    muebleVentas.set(v.mueble_catalogo_id, prev);
  }
  const topMuebles = [...muebleVentas.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 3);

  const clienteVentas = new Map<string, number>();
  for (const v of ventasMueblesMes) {
    clienteVentas.set(v.cliente_id, (clienteVentas.get(v.cliente_id) ?? 0) + Number(v.total));
  }
  for (const c of contratosMes) {
    clienteVentas.set(
      c.cliente_id,
      (clienteVentas.get(c.cliente_id) ?? 0) + Number(c.monto_total ?? c.tarifa),
    );
  }
  for (const s of aserraderoMes) {
    if (!s.cliente_id) continue;
    clienteVentas.set(
      s.cliente_id,
      (clienteVentas.get(s.cliente_id) ?? 0) + Number(s.precio_cobrado),
    );
  }
  const topClientes = [...clienteVentas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Dashboard de ventas — {periodoLabel}</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            KPIs del mes en curso a través de los 5 sub-flujos del taller.
          </p>
        </div>
        <Link href="/ventas" className="text-sm font-semibold underline">
          ← Volver al hub
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ingresos del mes"
          value={formatPen(ingresoTotalMes)}
          hint={`${totalVentasMes} operaciones registradas`}
        />
        <MetricCard
          label="Órdenes activas"
          value={String(ordenesActivas.length)}
          hint="Personalizados en producción + terminados sin entregar"
        />
        <MetricCard
          label="Margen promedio"
          value={`${margenPromedio.toFixed(1)}%`}
          hint={`Sobre ${margenes.length} cotizaciones del mes`}
        />
        <MetricCard
          label="Cobros vencidos"
          value={String(cobrosVencidos.length)}
          hint={
            cobrosVencidos.length > 0
              ? `Total ${formatPen(cobrosVencidos.reduce((a, c) => a + c.monto, 0))}`
              : "Sin pendientes"
          }
        />
      </section>

      <Card>
        <CardTitle>Ingresos por sub-flujo</CardTitle>
        <CardDescription>Distribución del mes {periodoLabel}.</CardDescription>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Sub-flujo</TH>
                <TH className="text-right">Operaciones</TH>
                <TH className="text-right">Ingresos</TH>
                <TH className="text-right">Participación</TH>
              </TRow>
            </THead>
            <tbody>
              {[
                { label: "Muebles terminados", qty: ventasMueblesMes.length, monto: ingresoMuebles },
                { label: "Madera cortada", qty: ventasMaderaMes.length, monto: ingresoMadera },
                { label: "Alquiler Bomba Mixer", qty: contratosMes.length, monto: ingresoAlquiler },
                { label: "Servicios aserradero", qty: aserraderoMes.length, monto: ingresoAserradero },
              ].map((row) => (
                <TRow key={row.label}>
                  <TD>{row.label}</TD>
                  <TD className="text-right">{row.qty}</TD>
                  <TD className="text-right font-semibold">{formatPen(row.monto)}</TD>
                  <TD className="text-right text-[var(--color-text-secondary)]">
                    {ingresoTotalMes > 0
                      ? `${((row.monto / ingresoTotalMes) * 100).toFixed(1)}%`
                      : "—"}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Top 3 muebles vendidos</CardTitle>
          <CardDescription>Por cantidad de unidades en el mes.</CardDescription>
          <div className="mt-3 space-y-2">
            {topMuebles.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Sin ventas de muebles este mes.
              </p>
            ) : (
              topMuebles.map(([id, info]) => {
                const mueble = muebleById.get(id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">{mueble?.nombre ?? "Mueble"}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {mueble?.codigo ?? ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge>{info.qty} u</Badge>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {formatPen(info.ingreso)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Top 3 clientes</CardTitle>
          <CardDescription>Mayor facturación combinada en el mes.</CardDescription>
          <div className="mt-3 space-y-2">
            {topClientes.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Sin facturación a clientes este mes.
              </p>
            ) : (
              topClientes.map(([id, monto]) => {
                const cliente = clienteById.get(id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">{cliente?.nombre ?? "Cliente"}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {cliente?.telefono ?? "Sin teléfono"}
                      </p>
                    </div>
                    <p className="font-semibold">{formatPen(monto)}</p>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
