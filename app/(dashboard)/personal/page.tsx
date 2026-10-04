import { PersonalContextPanels } from "@/components/personal/personal-context-panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getPersonalRows } from "@/lib/data";
import { canMutateRRHH } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";
import { FiltroActivo } from "@/components/inicio/filtro-activo";
import { getAdelantosPendientesRows } from "@/lib/inicio-pendientes";

export default async function PersonalPage({ searchParams }: {
  searchParams?: Promise<{ adelantos?: string | string[] }>;
}) {
  const adelantosParam = (await searchParams)?.adelantos;
  const soloPendientes = (Array.isArray(adelantosParam) ? adelantosParam[0] : adelantosParam) === "pendiente";
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [personal, pendientes] = await Promise.all([
    getPersonalRows(), soloPendientes ? getAdelantosPendientesRows() : Promise.resolve(null),
  ]);
  const { empleados, sueldos } = personal;
  const adelantos = pendientes ?? personal.adelantos;
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
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Empleados, adelantos y sueldos desde paneles laterales.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {!canMutate ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
              Tu rol tiene acceso de lectura en personal, pero no puede registrar cambios.
            </p>
          ) : null}
          {canMutate ? (
            <PersonalContextPanels
              empleados={empleados.map((e) => ({ id: e.id, nombre: e.nombre }))}
              mockData={comboMock}
            />
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="adelantos-pendientes" className="scroll-mt-24">
          <CardTitle>{soloPendientes ? "Adelantos pendientes" : "Adelantos recientes"}</CardTitle>
          {pendientes ? <div className="mt-4"><FiltroActivo label="Adelantos por regularizar" total={pendientes.length} clearHref="/personal#adelantos-pendientes" clearLabel="Ver todos los adelantos" /></div> : null}
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Empleado</TH>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                  <TH className="text-right">Monto</TH>
                </TRow>
              </THead>
              <tbody>
                {adelantos.map((row) => {
                  const empName = (row as { empleados?: { nombre?: string } }).empleados?.nombre || empleados.find((e) => e.id === row.empleado_id)?.nombre || "—";
                  return (
                    <TRow key={row.id}>
                      <TD className="font-medium">{empName}</TD>
                      <TD>{formatDate(row.fecha)}</TD>
                      <TD>
                        <Badge variant={row.estado === "pendiente" ? "warning" : "success"}>{row.estado}</Badge>
                      </TD>
                      <TD className="text-right font-semibold">{formatPen(Number(row.monto))}</TD>
                    </TRow>
                  );
                })}
                {adelantos.length === 0 ? <TRow><TD colSpan={4} className="py-6 text-center text-[var(--katia-text-secondary)]">{soloPendientes ? "No hay adelantos pendientes." : "Aún no hay adelantos registrados."}</TD></TRow> : null}
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
                  <TH>Empleado</TH>
                  <TH>Periodo</TH>
                  <TH className="text-right">Bruto</TH>
                  <TH className="text-right">Descuento</TH>
                  <TH className="text-right">Neto</TH>
                </TRow>
              </THead>
              <tbody>
                {sueldos.map((row) => {
                  const empName = (row as { empleados?: { nombre?: string } }).empleados?.nombre || empleados.find((e) => e.id === row.empleado_id)?.nombre || "—";
                  return (
                    <TRow key={row.id}>
                      <TD className="font-medium">{empName}</TD>
                      <TD>{row.periodo}</TD>
                      <TD className="text-right">{formatPen(Number(row.monto_bruto))}</TD>
                      <TD className="text-right">{formatPen(Number(row.descuentos))}</TD>
                      <TD className="text-right font-semibold">{formatPen(Number(row.monto_neto))}</TD>
                    </TRow>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
