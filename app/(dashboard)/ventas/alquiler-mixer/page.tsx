import Link from "next/link";
import { ContextActionPanel } from "@/components/context-action-panel";
import { CierreContratoForm } from "@/components/sales/cierre-contrato-form";
import { ContratoAlquilerPanel } from "@/components/sales/contrato-alquiler-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getAlquilerRows, getClientesRows, getInventarioProductosRows } from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export default async function AlquilerMixerPage() {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [clientes, alquilerResult, inventarioProductos] = await Promise.all([
    getClientesRows(),
    getAlquilerRows(),
    getInventarioProductosRows(true),
  ]);
  const contratos = alquilerResult.rows;
  const alquilerLoadWarning = alquilerResult.loadWarning;
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);

  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));
  const abiertos = contratos.filter((c) => c.estado === "abierto");
  const totalDepositos = abiertos.reduce(
    (acc, c) => acc + (c.deposito_30 ?? 0),
    0,
  );

  const maquinasFiltradas = inventarioProductos
    .filter((p) => p.activo && p.categoria && p.categoria.toLowerCase().replace("á", "a").includes("maquina"))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
    }));

  const maquinas = maquinasFiltradas.length > 0 ? maquinasFiltradas : [
    { id: "bomba-mixer-default", nombre: "Bomba Mixer Standard", categoria: "Maquina" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Alquiler Bomba Mixer</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Contrato extendido con depósito 30% automático y cierre con penalidades configurables.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Nuevo contrato (depósito e ingreso) o cierre con penalidades.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMutate ? (
            <>
              <ContratoAlquilerPanel clientes={clientes} maquinas={maquinas} mockData={comboMock} />

              <ContextActionPanel
                triggerLabel="Cerrar contrato"
                title="Cierre de contrato"
                description="Aplica penalidades por retraso, devolución tardía o daños."
              >
                <CierreContratoForm contratos={abiertos} />
              </ContextActionPanel>
            </>
          ) : (
            <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
              Tu rol es de solo lectura.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Resumen</CardTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Contratos abiertos</p>
            <p className="text-2xl font-bold">{abiertos.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Depósitos retenidos</p>
            <p className="text-2xl font-bold">{formatPen(totalDepositos)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Penalidades activas</p>
            <p className="text-2xl font-bold">
              {formatPen(contratos.reduce((acc, c) => acc + Number(c.penalidad ?? 0), 0))}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Contratos</CardTitle>
        <CardDescription>{contratos.length} contratos en total.</CardDescription>
        {alquilerLoadWarning ? (
          <p
            role="alert"
            className="mt-3 text-sm font-medium text-[var(--color-danger)]"
          >
            {alquilerLoadWarning}
          </p>
        ) : null}
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Código</TH>
                <TH>Inicio</TH>
                <TH>Cliente</TH>
                <TH>Equipo</TH>
                <TH>Estado</TH>
                <TH className="text-right">Monto</TH>
                <TH className="text-right">Depósito</TH>
                <TH className="text-right">Penalidad</TH>
                <TH className="text-right">Acciones</TH>
              </TRow>
            </THead>
            <tbody>
              {contratos.map((c) => (
                <TRow key={c.id}>
                  <TD className="font-mono text-xs">{c.codigo ?? `—`}</TD>
                  <TD>{formatDate(c.fecha_inicio)}</TD>
                  <TD>{clientesById.get(c.cliente_id) ?? "—"}</TD>
                  <TD>{c.activo}</TD>
                  <TD>
                    <Badge variant={c.estado === "abierto" ? "warning" : "success"}>
                      {c.estado}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    {c.monto_total != null ? formatPen(c.monto_total) : "—"}
                  </TD>
                  <TD className="text-right">
                    {c.deposito_30 != null ? formatPen(c.deposito_30) : "—"}
                  </TD>
                  <TD className="text-right font-semibold">
                    {formatPen(Number(c.penalidad ?? 0))}
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/ventas/alquiler-mixer/${c.id}/pdf`}
                        target="_blank"
                        className="text-xs font-semibold text-[var(--color-accent)] underline"
                      >
                        Imprimir
                      </Link>
                      {canMutate && c.estado === "abierto" ? (
                        <Link
                          href={`/ventas/alquiler-mixer/${c.id}/editar`}
                          className="text-xs font-semibold text-[var(--color-text-secondary)] underline hover:text-[var(--color-text-primary)]"
                        >
                          Editar
                        </Link>
                      ) : null}
                    </div>
                  </TD>
                </TRow>
              ))}
              {contratos.length === 0 ? (
                <TRow>
                  <TD colSpan={9} className="text-center text-[var(--color-text-secondary)]">
                    Aún no hay contratos. Crea uno con &quot;Nuevo contrato&quot;.
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
