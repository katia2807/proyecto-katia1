import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getComprasMaderaRows, getProveedoresRows } from "@/lib/data";
import { formatDate, formatPen } from "@/lib/utils";

type CeldaPrecio = {
  precio: number;
  fecha: string;
  proveedorId: string;
};

export default async function ComparadorProveedoresPage() {
  const [compras, proveedores] = await Promise.all([
    getComprasMaderaRows(),
    getProveedoresRows(),
  ]);

  // Construye matriz: especie → proveedorId → último precio.
  const especies = Array.from(new Set(compras.map((c) => c.especie_madera))).sort();
  const proveedoresOrden = [...proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const matriz = new Map<string, Map<string, CeldaPrecio>>();
  for (const compra of compras) {
    const especieMap = matriz.get(compra.especie_madera) ?? new Map<string, CeldaPrecio>();
    const previo = especieMap.get(compra.proveedor_id);
    if (!previo || compra.fecha > previo.fecha) {
      especieMap.set(compra.proveedor_id, {
        precio: Number(compra.precio_unitario),
        fecha: compra.fecha,
        proveedorId: compra.proveedor_id,
      });
    }
    matriz.set(compra.especie_madera, especieMap);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Comparador de proveedores de madera</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Último precio por especie y proveedor. Las celdas más baratas de cada fila aparecen resaltadas en verde.
        </p>
      </div>

      <Card>
        <CardTitle>Matriz de precios</CardTitle>
        <CardDescription>
          {especies.length} especies cruzadas con {proveedoresOrden.length} proveedores.
        </CardDescription>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Especie</TH>
                {proveedoresOrden.map((p) => (
                  <TH key={p.id} className="text-right">
                    {p.nombre}
                  </TH>
                ))}
              </TRow>
            </THead>
            <tbody>
              {especies.map((especie) => {
                const fila = matriz.get(especie);
                const precios = fila ? [...fila.values()].map((c) => c.precio) : [];
                const minimo = precios.length > 0 ? Math.min(...precios) : null;
                return (
                  <TRow key={especie}>
                    <TD className="font-semibold capitalize">{especie}</TD>
                    {proveedoresOrden.map((p) => {
                      const celda = fila?.get(p.id);
                      if (!celda) {
                        return (
                          <TD key={p.id} className="text-right text-[var(--color-text-secondary)]">
                            —
                          </TD>
                        );
                      }
                      const esBarato = minimo !== null && celda.precio === minimo;
                      return (
                        <TD
                          key={p.id}
                          className={`text-right ${esBarato ? "bg-emerald-50 font-bold text-emerald-700" : ""}`}
                        >
                          {formatPen(celda.precio)}
                          <p className="text-[10px] text-[var(--color-text-secondary)]">
                            {formatDate(celda.fecha)}
                          </p>
                        </TD>
                      );
                    })}
                  </TRow>
                );
              })}
              {especies.length === 0 ? (
                <TRow>
                  <TD colSpan={1 + proveedoresOrden.length} className="text-center text-[var(--color-text-secondary)]">
                    Aún no hay compras de madera registradas.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Compras recientes</CardTitle>
        <CardDescription>Detalle de las últimas 20 compras de madera.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Proveedor</TH>
                <TH>Especie</TH>
                <TH className="text-right">Cant.</TH>
                <TH>Unidad</TH>
                <TH className="text-right">Precio unit.</TH>
                <TH className="text-right">Total</TH>
                <TH>Comprobante</TH>
              </TRow>
            </THead>
            <tbody>
              {compras.slice(0, 20).map((c) => {
                const proveedor = proveedoresOrden.find((p) => p.id === c.proveedor_id);
                return (
                  <TRow key={c.id}>
                    <TD>{formatDate(c.fecha)}</TD>
                    <TD>{proveedor?.nombre ?? "—"}</TD>
                    <TD>{c.especie_madera}</TD>
                    <TD className="text-right">{Number(c.cantidad).toFixed(2)}</TD>
                    <TD>{c.unidad}</TD>
                    <TD className="text-right">{formatPen(Number(c.precio_unitario))}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(c.total))}</TD>
                    <TD>
                      {c.url_comprobante ? (
                        <Link
                          href={c.url_comprobante}
                          target="_blank"
                          className="text-[var(--color-accent)] underline"
                        >
                          Ver
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">—</span>
                      )}
                    </TD>
                  </TRow>
                );
              })}
              {compras.length === 0 ? (
                <TRow>
                  <TD colSpan={8} className="text-center text-[var(--color-text-secondary)]">
                    Sin compras todavía.{" "}
                    <Link href="/ventas?quick=compra" className="text-[var(--color-accent)] underline">
                      Registrar compra
                    </Link>
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
