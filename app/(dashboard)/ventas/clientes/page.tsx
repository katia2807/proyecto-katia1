import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import {
  getAlquilerRows,
  getClientesRows,
  getCotizacionesRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
} from "@/lib/data";
import { formatPen } from "@/lib/utils";

type ClientesPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

function normalizeQ(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").trim().toLowerCase();
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const q = normalizeQ((await searchParams)?.q);
  const [clientes, ventasMuebles, ventasMadera, contratos, servicios, cotizaciones] = await Promise.all([
    getClientesRows(),
    getVentasMuebleTerminadoRows(),
    getVentasRows(),
    getAlquilerRows(),
    getServiciosAserraderoRows(),
    getCotizacionesRows(),
  ]);

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

  const filtrados = clientes
    .filter((c) => {
      if (!q) return true;
      return (
        c.nombre.toLowerCase().includes(q) ||
        (c.documento ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const tA = totales.get(a.id)?.total ?? 0;
      const tB = totales.get(b.id)?.total ?? 0;
      return tB - tA;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Clientes</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Vista 360 con todo el historial: cotizaciones, ventas, alquileres y servicios.
          </p>
        </div>
        <Link href="/ventas" className="text-sm font-semibold underline">
          ← Volver al hub
        </Link>
      </div>

      <Card>
        <CardTitle>Buscar cliente</CardTitle>
        <CardDescription>Por nombre, documento o teléfono.</CardDescription>
        <form className="mt-3 flex gap-2" method="get">
          <Field
            name="q"
            label="Búsqueda"
            defaultValue={q}
            placeholder="Ej. Lenin, 12345678…"
            className="flex-1"
          />
        </form>
      </Card>

      <Card>
        <CardTitle>Listado ({filtrados.length})</CardTitle>
        <CardDescription>Ordenado por facturación total descendente.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Nombre</TH>
                <TH>Documento</TH>
                <TH>Teléfono</TH>
                <TH>Tipo</TH>
                <TH className="text-right">Operaciones</TH>
                <TH className="text-right">Facturado</TH>
                <TH className="text-right">Detalle</TH>
              </TRow>
            </THead>
            <tbody>
              {filtrados.map((c) => {
                const t = totales.get(c.id) ?? { ops: 0, total: 0 };
                return (
                  <TRow key={c.id}>
                    <TD className="font-semibold">{c.nombre}</TD>
                    <TD>{c.documento ?? "—"}</TD>
                    <TD>{c.telefono ?? "—"}</TD>
                    <TD>
                      {c.tipo_persona ? (
                        <Badge variant="neutral">{c.tipo_persona}</Badge>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">—</span>
                      )}
                    </TD>
                    <TD className="text-right">{t.ops}</TD>
                    <TD className="text-right font-semibold">{formatPen(t.total)}</TD>
                    <TD className="text-right">
                      <Link
                        href={`/ventas/clientes/${c.id}`}
                        className="text-xs font-semibold text-[var(--color-accent)] underline"
                      >
                        Ver 360
                      </Link>
                    </TD>
                  </TRow>
                );
              })}
              {filtrados.length === 0 ? (
                <TRow>
                  <TD colSpan={7} className="text-center text-[var(--color-text-secondary)]">
                    Sin resultados.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
