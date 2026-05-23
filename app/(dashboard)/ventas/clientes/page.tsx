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
  getCobrosVencidos,
  getOrdenesProduccionRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
} from "@/lib/data";

type PageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    q?: string | string[];
    tipo?: string | string[];
    estado?: string | string[];
  }>;
};

function first(value: string | string[] | undefined, fallback = "") {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? fallback).trim().toLowerCase();
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q      = first(params?.q);
  const tipo   = first(params?.tipo);
  const estado = first(params?.estado);

  const [clientes, ventasMuebles, ventasMadera, alquilerBundle, servicios, cotizaciones, ordenes, cobros] =
    await Promise.all([
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

  const totales = new Map<string, { ops: number; total: number; tipos: Set<string> }>();
  const addTotales = (clienteId: string, amount: number, tipoLabel: string) => {
    const acc = totales.get(clienteId) ?? { ops: 0, total: 0, tipos: new Set<string>() };
    acc.ops += 1; acc.total += amount; acc.tipos.add(tipoLabel);
    totales.set(clienteId, acc);
  };
  for (const v of ventasMuebles) addTotales(v.cliente_id, Number(v.total), "Mueble");
  for (const v of ventasMadera)  addTotales(v.cliente_id, Number(v.total), "Madera");
  for (const c of contratos)     addTotales(c.cliente_id, Number(c.monto_total ?? c.tarifa), "Alquiler");
  for (const s of servicios)     if (s.cliente_id) addTotales(s.cliente_id, Number(s.precio_cobrado), "Servicio");
  for (const c of cotizaciones)  addTotales(c.cliente_id, 0, "Cotización");

  const pedidosActivos = new Map<string, number>();
  for (const o of ordenes)
    if (o.estado !== "entregado" && o.estado !== "terminado")
      pedidosActivos.set(o.cliente_id, (pedidosActivos.get(o.cliente_id) ?? 0) + 1);

  const pagosPendientes = new Map<string, number>();
  for (const c of cobros)
    pagosPendientes.set(c.cliente_id, (pagosPendientes.get(c.cliente_id) ?? 0) + 1);

  const cotizacionesPorCliente = new Map<string, { id: string; fecha: string; monto: number; estado: string; href: string }[]>();
  for (const c of cotizaciones) {
    const rows = cotizacionesPorCliente.get(c.cliente_id) ?? [];
    rows.push({ id: c.id, fecha: c.fecha, monto: Number(c.precio_acordado), estado: c.estado, href: `/ventas/muebles-personalizados/${c.id}/pdf` });
    cotizacionesPorCliente.set(c.cliente_id, rows);
  }

  const filtrados = clientes
    .filter((c) => {
      if (q && !(c.nombre.toLowerCase().includes(q) || (c.documento ?? "").toLowerCase().includes(q) || (c.telefono ?? "").toLowerCase().includes(q))) return false;
      if (tipo   && c.tipo_persona !== tipo)  return false;
      if (estado && c.estado      !== estado) return false;
      return true;
    })
    .sort((a, b) => (totales.get(b.id)?.total ?? 0) - (totales.get(a.id)?.total ?? 0));

  const clientesDetalle = filtrados.map((c) => {
    const t = totales.get(c.id) ?? { ops: 0, total: 0, tipos: new Set<string>() };
    return {
      ...c,
      operaciones:     t.ops,
      facturado:       t.total,
      pedidosActivos:  pedidosActivos.get(c.id)  ?? 0,
      pagosPendientes: pagosPendientes.get(c.id) ?? 0,
      cotizaciones:    (cotizacionesPorCliente.get(c.id) ?? []).slice(0, 5),
    };
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">
            Clientes
          </h2>
          <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
            Compradores registrados en el sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NuevoClienteInline />
          <Link href="/ventas">
            <Button type="button" variant="ghost" size="sm">← Ventas</Button>
          </Link>
        </div>
      </div>

      {/* ── COMPRADORES ── */}
      {cobros.length > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--katia-radius-md)] border border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/5 px-3 py-2 text-xs font-semibold text-[var(--katia-danger)]">
          ⚠ {cobros.length} cobro(s) vencido(s) — revisa el estado de cada cliente.
        </div>
      )}
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
          <p className="text-base font-medium text-[var(--katia-text-primary)]">
            {q || tipo || estado ? "Sin resultados para los filtros" : "Aún no hay compradores"}
          </p>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Compradores ({clientesDetalle.length})</CardTitle>
            <p className="text-xs text-[var(--katia-text-tertiary)]">Clic en una fila para ver el detalle</p>
          </div>
          <div className="mt-4">
            <ClientesMasterDetail clientes={clientesDetalle} />
          </div>
        </Card>
      )}

    </div>
  );
}
