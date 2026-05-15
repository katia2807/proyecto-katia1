import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientesMasterDetail } from "@/components/ventas/clientes-master-detail";
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
          <h2 className="text-xl font-bold">Clientes</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Lista, seleccion y detalle 360 del cliente con cotizaciones, pedidos y pagos pendientes.
          </p>
        </div>
        <Link href="/ventas" className="text-sm font-semibold underline">
          Volver al hub
        </Link>
      </div>

      <Card>
        <CardTitle>Buscar y filtrar clientes</CardTitle>
        <CardDescription>Por nombre, documento, tipo y estado.</CardDescription>
        <form className="mt-3 grid items-end gap-3 md:grid-cols-4" method="get">
          <Field name="q" label="Busqueda" defaultValue={q} placeholder="Ej. Lenin, 12345678" />
          <SelectField name="tipo" label="Tipo" defaultValue={tipo}>
            <option value="">Todos</option>
            <option value="empresa">Empresa</option>
            <option value="natural">Persona natural</option>
          </SelectField>
          <SelectField name="estado" label="Estado" defaultValue={estado}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="moroso">Moroso</option>
          </SelectField>
          <Button type="submit">Filtrar</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Listado ({clientesDetalle.length})</CardTitle>
        <CardDescription>Haz clic en una fila para abrir el drawer lateral.</CardDescription>
        <div className="mt-3">
          <ClientesMasterDetail clientes={clientesDetalle} />
        </div>
      </Card>
    </div>
  );
}
