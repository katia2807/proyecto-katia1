import Link from "next/link";
import { AserraderoPanel } from "@/components/sales/aserradero-panel";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getClientesRows,
  getServiciosAserraderoRows,
  getServiciosEspecialesTarifaRows,
} from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export default async function AserraderoServiciosPage() {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [clientes, servicios, tarifas] = await Promise.all([
    getClientesRows(),
    getServiciosAserraderoRows(),
    getServiciosEspecialesTarifaRows(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));

  const totalIngresos = servicios.reduce((acc, s) => acc + Number(s.precio_cobrado), 0);
  const totalUtilidad = servicios.reduce((acc, s) => acc + Number(s.utilidad), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Servicio aserradero</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Cubicaje rápido y procesos especiales (cepillado, traslapado, machembrado, corte vertical y horizontal).
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Nuevo servicio con cubicaje base y procesos extra.</CardDescription>
        </div>
        {canMutate ? (
          <AserraderoPanel
            clientes={clientes}
            serviciosEspeciales={tarifas}
            mockData={comboMock}
          />
        ) : (
          <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
            Tu rol es de solo lectura.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Resumen</CardTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Servicios totales</p>
            <p className="text-2xl font-bold">{servicios.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Ingresos acumulados</p>
            <p className="text-2xl font-bold">{formatPen(totalIngresos)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Utilidad acumulada</p>
            <p className="text-2xl font-bold">{formatPen(totalUtilidad)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Servicios registrados</CardTitle>
        <CardDescription>Histórico de servicios facturados.</CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Cliente</TH>
                <TH className="text-right">Pies cúbicos</TH>
                <TH className="text-right">Costo</TH>
                <TH className="text-right">Cobrado</TH>
                <TH className="text-right">Utilidad</TH>
              </TRow>
            </THead>
            <tbody>
              {servicios.map((s) => (
                <TRow key={s.id}>
                  <TD>{formatDate(s.fecha)}</TD>
                  <TD>{clientesById.get(s.cliente_id) ?? "—"}</TD>
                  <TD className="text-right">{Number(s.pies_cubicos).toFixed(2)}</TD>
                  <TD className="text-right">{formatPen(Number(s.costo_cubicaje))}</TD>
                  <TD className="text-right font-semibold">
                    {formatPen(Number(s.precio_cobrado))}
                  </TD>
                  <TD className="text-right text-[var(--color-success)]">
                    {formatPen(Number(s.utilidad))}
                  </TD>
                </TRow>
              ))}
              {servicios.length === 0 ? (
                <TRow>
                  <TD colSpan={6} className="text-center text-[var(--color-text-secondary)]">
                    Aún no hay servicios registrados.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="text-center py-4">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Las tarifas de servicios especiales se configuran en{" "}
          <Link href="/configuracion?tab=tarifas" className="font-semibold text-[var(--color-accent)] underline hover:brightness-110">
            Configuración &gt; Tarifas
          </Link>
        </p>
      </div>
    </div>
  );
}
