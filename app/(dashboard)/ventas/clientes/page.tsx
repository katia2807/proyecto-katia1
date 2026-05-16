import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientesMasterDetail } from "@/components/ventas/clientes-master-detail";
import { NuevoClienteInline } from "@/components/ventas/nuevo-cliente-inline";
import {
  getAlquilerRows,
  getClientesRows,
  getCotizacionesRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
  getOrdenesProduccionRows,
  getCobrosVencidos,
} from "@/lib/data";

type ClientesPageProps = {
  searchParams?: Promise<{ q?: string | string[]; tipo?: string | string[]; estado?: string | string[] }>;
};

function normalizeQ(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").trim().toLowerCase();
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const params = await searchParams;
  const q = normalizeQ(params?.q);
  const tipo = normalizeQ(params?.tipo);
  const estado = normalizeQ(params?.estado);

  const [clientes, ventasMuebles, ventasMadera, alquilerBundle, servicios, cotizaciones, ordenes, cobros] = await Promise.all([
    getClientesRows(),
    getVentasMuebleTerminadoRows(),
    getVentasRows(),
    getAlquilerRows(),
    getServiciosAserraderoRows(),
    getCotizacionesRows(),
    getOrdenesProduccionRows(),
    getCobrosVencidos(),
  ]);
  const contratos = alquilerBundle.rows;

  const totales = new Map<string, { ops: number; total: number }>();
  for (const v of ventasMuebles) {
    const acc = totales.get(v.cliente_id) ?? { ops: 0, total: 0 };
    acc.ops += 1;
    acc.total += Number(v.total);
    totales.set(v.cliente_id, acc);
  }
  for (const v of ventasMadera) {
    const acc = totales.get(v.cliente_id) ?? { ops: 0, total: 0 };
    acc.ops += 1;
    acc.total += Number(v.total);
    totales.set(v.cliente_id, acc);
  }
  for (const c of contratos) {
    const acc = totales.get(c.cliente_id) ?? { ops: 0, total: 0 };
    acc.ops += 1;
    acc.total += Number(c.monto_total ?? c.tarifa);
    totales.set(c.cliente_id, acc);
  }
  for (const s of servicios) {
    if (!s.cliente_id) continue;
    const acc = totales.get(s.cliente_id) ?? { ops: 0, total: 0 };
    acc.ops += 1;
    acc.total += Number(s.precio_cobrado);
    totales.set(s.cliente_id, acc);
  }
  for (const c of cotizaciones) {
    const acc = totales.get(c.cliente_id) ?? { ops: 0, total: 0 };
    acc.ops += 1;
    totales.set(c.cliente_id, acc);
  }

  const pedidosActivos = new Map<string, number>();
  for (const o of ordenes) {
    if (o.estado !== "entregado" && o.estado !== "terminado") {
      pedidosActivos.set(o.cliente_id, (pedidosActivos.get(o.cliente_id) ?? 0) + 1);
    }
  }

  const pagosPendientes = new Map<string, number>();
  for (const c of cobros) {
    pagosPendientes.set(c.cliente_id, (pagosPendientes.get(c.cliente_id) ?? 0) + 1);
  }

  const cotizacionesPorCliente = new Map<string, { id: string; fecha: string; monto: number; estado: string; href: string }[]>();
  for (const c of cotizaciones) {
    const rows = cotizacionesPorCliente.get(c.cliente_id) ?? [];
    rows.push({
      id: c.id,
      fecha: c.fecha,
      monto: Number(c.precio_acordado),
      estado: c.estado,
      href: `/ventas/muebles-personalizados/${c.id}/pdf`,
    });
    cotizacionesPorCliente.set(c.cliente_id, rows);
  }

  const filtrados = clientes
    .filter((c) => {
      if (q && !(c.nombre.toLowerCase().includes(q) || (c.documento ?? "").toLowerCase().includes(q) || (c.telefono ?? "").toLowerCase().includes(q))) return false;
      if (tipo && c.tipo_persona !== tipo) return false;
      if (estado && c.estado !== estado) return false;
      return true;
    })
    .sort((a, b) => (totales.get(b.id)?.total ?? 0) - (totales.get(a.id)?.total ?? 0));

  const clientesDetalle = filtrados.map((c) => {
    const t = totales.get(c.id) ?? { ops: 0, total: 0 };
    return {
      ...c,
      operaciones: t.ops,
      facturado: t.total,
      pedidosActivos: pedidosActivos.get(c.id) ?? 0,
      pagosPendientes: pagosPendientes.get(c.id) ?? 0,
      cotizaciones: (cotizacionesPorCliente.get(c.id) ?? []).slice(0, 5),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">
            Clientes
          </h2>
          <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} registrado{clientes.length !== 1 ? "s" : ""}.
            {cobros.length > 0 ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--katia-danger)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--katia-danger)]">
                {cobros.length} cobro{cobros.length !== 1 ? "s" : ""} vencido{cobros.length !== 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NuevoClienteInline />
          <Link href="/ventas">
            <Button type="button" variant="ghost" size="sm">← Volver a ventas</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardTitle>Buscar y filtrar</CardTitle>
        <form className="mt-3 grid items-end gap-3 sm:grid-cols-2 md:grid-cols-4" method="get">
          <Field name="q" label="Búsqueda" defaultValue={q} placeholder="Nombre, DNI, teléfono…" />
          <SelectField name="tipo" label="Tipo" defaultValue={tipo}>
            <option value="">Todos los tipos</option>
            <option value="empresa">Empresa</option>
            <option value="natural">Persona natural</option>
          </SelectField>
          <SelectField name="estado" label="Estado" defaultValue={estado}>
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="moroso">Con deuda</option>
            <option value="vip">VIP</option>
          </SelectField>
          <Button type="submit">Filtrar</Button>
        </form>
      </Card>

      {clientesDetalle.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-overlay)] text-[var(--katia-text-tertiary)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-base font-medium text-[var(--katia-text-primary)]">
            {q || tipo || estado ? "Sin resultados para los filtros aplicados" : "Aún no hay clientes registrados"}
          </p>
          <p className="max-w-sm text-sm text-[var(--katia-text-secondary)]">
            {q || tipo || estado
              ? "Prueba con otros criterios de búsqueda."
              : "Registra el primer cliente para empezar a cotizar y vender."}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Listado ({clientesDetalle.length})</CardTitle>
            <p className="text-xs text-[var(--katia-text-tertiary)]">
              Clic en una fila para ver el detalle
            </p>
          </div>
          <div className="mt-4">
            <ClientesMasterDetail clientes={clientesDetalle} />
          </div>
        </Card>
      )}
    </div>
  );
}
