import { PersonalContextPanels } from "@/components/personal/personal-context-panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getPersonalRows } from "@/lib/data";
import { canMutateRRHH } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export default async function PersonalPage() {
  const { empleados, adelantos, sueldos } = await getPersonalRows();
  const role = await getCurrentUserRole();
  const canMutate = canMutateRRHH(role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Gestión de personal</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Sueldos, adelantos a choferes/operarios y control por períodos.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>Elige solo la acción que vas a hacer ahora.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {!canMutate ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Tu rol tiene acceso de lectura en personal, pero no puede registrar cambios.
            </p>
          ) : null}
          {canMutate ? (
            <PersonalContextPanels empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre }))} />
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="adelantos-pendientes">
          <CardTitle>Adelantos recientes</CardTitle>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Monto</TH>
                </TRow>
              </THead>
              <tbody>
                {adelantos.map((row) => (
                  <TRow key={row.id}>
                    <TD>{formatDate(row.fecha)}</TD>
                    <TD>
                      <Badge variant={row.estado === "pendiente" ? "warning" : "success"}>{row.estado}</Badge>
                    </TD>
                    <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardTitle>Sueldos registrados</CardTitle>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Periodo</TH>
                  <TH className="text-right">Bruto</TH>
                  <TH className="text-right">Descuento</TH>
                  <TH className="text-right">Neto</TH>
                </TRow>
              </THead>
              <tbody>
                {sueldos.map((row) => (
                  <TRow key={row.id}>
                    <TD>{row.periodo}</TD>
                    <TD className="text-right">{formatPen(Number(row.monto_bruto))}</TD>
                    <TD className="text-right">{formatPen(Number(row.descuentos))}</TD>
                    <TD className="text-right font-semibold">{formatPen(Number(row.monto_neto))}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
