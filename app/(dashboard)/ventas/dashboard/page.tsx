import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { requirePageAccess } from "@/lib/auth";
import { readCompleteTable, readCompleteVentas } from "@/lib/complete-data";
import { getGerencialSources } from "@/lib/gerencial-data";
import { buildGerencialModel } from "@/lib/gerencial-model";
import { formatPen, fechaHoyPeru } from "@/lib/utils";
import { computeEconomiaInterna } from "@/lib/cotizacion-calculos";
import { parseCotizacionDetalle } from "@/lib/cotizacion-unificada-payload";


function inMes(fecha: string, anio: number, mes: number) {
  return fecha.slice(0,7) === anio+"-"+String(mes).padStart(2,"0");
}
export default async function VentasDashboardPage() {
  const context = await requirePageAccess("/ventas/dashboard");
  const [anio,mes] = fechaHoyPeru().split("-").map(Number);
  const periodoLabel = String(mes).padStart(2,"0")+"/"+anio;
  const org = context.organizationId;
  const [ventasMuebles,ordenes,ventasMadera,contratos,aserradero,cotizaciones,cotizacionesUnificadas,catalogo,clientes,sources] = await Promise.all([
    readCompleteTable("ventas_mueble_terminado",org),readCompleteTable("ordenes_produccion",org),readCompleteVentas(org),readCompleteTable("alquileres",org),readCompleteTable("servicios_aserradero",org),readCompleteTable("cotizaciones_mueble",org),readCompleteTable("cotizaciones_unificadas",org),readCompleteTable("muebles_catalogo",org),readCompleteTable("clientes",org),getGerencialSources("hoy",org),
  ]);
  if([sources.movimientos_caja,sources.ventas_madera,sources.ventas_madera_cortada,sources.ventas_mueble_terminado,sources.alquileres].some(rows=>rows===null))throw new Error("No se pudieron comprobar todos los créditos. Actualiza la página.");
  const mando = buildGerencialModel(sources);
  const cobrosVencidos = mando.actions.filter(item=>item.id.startsWith("credito:") && item.date && item.date < mando.periods.today);
  const muebleById = new Map(catalogo.map((m) => [m.id, m]));
  const clienteById = new Map(clientes.map((c) => [c.id, c]));

  const ventasMueblesMes = ventasMuebles.filter((v) => inMes(v.fecha, anio, mes));
  const ventasMaderaMes = ventasMadera.filter((v) => v.estado === "confirmada" && inMes(v.fecha, anio, mes));
  const contratosMes = contratos.filter((c) => inMes(c.fecha_inicio, anio, mes));
  const aserraderoMes = aserradero.filter((s) => inMes(s.fecha, anio, mes));
  const cotizacionesMes = cotizaciones.filter((c) => c.estado === "confirmada" && inMes(c.fecha, anio, mes));
  const ordenesActivas = ordenes.filter((o) => o.estado !== "entregado");

  const ingresoMuebles = ventasMueblesMes.reduce((acc, v) => acc + Number(v.total), 0);
  const ingresoMadera = ventasMaderaMes.reduce((acc, v) => acc + Number(v.total), 0);
  const ingresoAlquiler = contratosMes.reduce(
    (acc, c) => acc + Number(c.monto_total ?? 0),
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
      const costo = "costo_estimado" in c && c.costo_estimado !== null ? Number(c.costo_estimado) : NaN;
      if (total <= 0 || !Number.isFinite(costo)) return null;
      return ((total - costo) / total) * 100;
    })
    .filter((x): x is number => x != null);

  const margenesUnificados = cotizacionesUnificadasMes
    .map((c) => {
      const econ = computeEconomiaInterna(parseCotizacionDetalle(c.detalle));
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
  for (const v of ventasMaderaMes) {
    clienteVentas.set(v.cliente_id, (clienteVentas.get(v.cliente_id) ?? 0) + Number(v.total));
  }
  for (const v of ventasMueblesMes) {
    clienteVentas.set(v.cliente_id, (clienteVentas.get(v.cliente_id) ?? 0) + Number(v.total));
  }
  for (const c of contratosMes) {
    clienteVentas.set(
      c.cliente_id,
      (clienteVentas.get(c.cliente_id) ?? 0) + Number(c.monto_total ?? 0),
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
          <h2 className="text-xl font-bold">Resumen de ventas — {periodoLabel}</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Operaciones del mes. Los importes registrados no equivalen a dinero cobrado; consulta Caja para comprobar ingresos.
          </p>
        </div>
        <Link href="/ventas" className="text-sm font-semibold underline">
          ← Volver a ventas
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Importes registrados del mes"
          value={formatPen(ingresoTotalMes)}
          hint={`${totalVentasMes} operaciones; alquileres sin total quedan pendientes de comprobar`}
        />
        <MetricCard
          label="Órdenes activas"
          value={String(ordenesActivas.length)}
          hint="Personalizados en producción + terminados sin entregar"
        />
        <MetricCard
          label="Margen promedio"
          value={margenes.length ? `${margenPromedio.toFixed(1)}%` : "Por comprobar"}
          hint={`Sobre ${margenes.length} cotizaciones del mes`}
        />
        <MetricCard
          label="Cobros vencidos"
          value={String(cobrosVencidos.length)}
          hint={
            cobrosVencidos.length > 0
              ? `Saldos conocidos ${formatPen(cobrosVencidos.reduce((a, c) => a + (c.amount ?? 0), 0))}`
              : "Sin vencidos con fecha registrada"
          }
        />
      </section>

      <Card>
        <CardTitle>Importes por actividad</CardTitle>
        <CardDescription>Distribución del mes {periodoLabel}. Alquileres sin importe total no suman su tarifa como si fuera el total.</CardDescription>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Sub-flujo</TH>
                <TH className="text-right">Operaciones</TH>
                <TH className="text-right">Importe registrado</TH>
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
          <CardDescription>Mayores importes registrados del mes, combinando madera, muebles, alquileres y servicios.</CardDescription>
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
