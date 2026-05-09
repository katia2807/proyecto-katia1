import Link from "next/link";
import { createZonaEntrega } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getZonasEntregaRows } from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatPen } from "@/lib/utils";

export default async function ZonasEntregaPage() {
  const zonas = await getZonasEntregaRows();
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Zonas de entrega</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Define las zonas que sirven al taller con su tarifa de transporte. Aparecen como selector
            en cualquier formulario de entrega.
          </p>
        </div>
        <Link href="/ventas" className="text-sm font-semibold underline">
          ← Volver al hub
        </Link>
      </div>

      {canMutate ? (
        <Card>
          <CardTitle>Registrar nueva zona</CardTitle>
          <CardDescription>
            La tarifa se sugiere al elegir la zona en el formulario de venta.
          </CardDescription>
          <form action={createZonaEntrega} className="mt-3 grid gap-3 md:grid-cols-3">
            <Field name="nombre" label="Nombre de la zona" required placeholder="Ej. Cono norte" />
            <Field name="distancia_km" label="Distancia (km)" type="number" min="0" step="0.5" defaultValue="0" />
            <Field name="tarifa" label="Tarifa (S/.)" type="number" min="0" step="0.5" required />
            <div className="md:col-span-3">
              <Button>Guardar zona</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Zonas registradas</CardTitle>
        <CardDescription>
          {zonas.length} zona{zonas.length === 1 ? "" : "s"} activa{zonas.length === 1 ? "" : "s"}.
        </CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Nombre</TH>
                <TH className="text-right">Distancia (km)</TH>
                <TH className="text-right">Tarifa</TH>
              </TRow>
            </THead>
            <tbody>
              {zonas.map((z) => (
                <TRow key={z.id}>
                  <TD>{z.nombre}</TD>
                  <TD className="text-right">{z.distancia_km}</TD>
                  <TD className="text-right font-semibold">{formatPen(z.tarifa)}</TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
