import Link from "next/link";
import { ContextActionPanel } from "@/components/context-action-panel";
import { CierreContratoForm } from "@/components/sales/cierre-contrato-form";
import { ContratoAlquilerPanel } from "@/components/sales/contrato-alquiler-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { AlquilerMixerTable } from "@/components/sales/alquiler-mixer-table";
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
        <div className="mt-3">
          <AlquilerMixerTable
            contratos={contratos}
            clientesById={Object.fromEntries(clientes.map((c) => [c.id, c.nombre]))}
            canMutate={canMutate}
          />
        </div>
      </Card>
    </div>
  );
}
