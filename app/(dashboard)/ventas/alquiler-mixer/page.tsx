import { AlquilerMixerContextPanels } from "@/components/ventas/alquiler-mixer-context-panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AlquilerMixerTable } from "@/components/sales/alquiler-mixer-table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getAlquilerRows, getClientesRows, getInventarioProductosRows } from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatPen } from "@/lib/utils";

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
          Gestiona contratos de alquiler, cierres y equipos disponibles.
        </p>
      </div>

      <Card className="space-y-4 border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle>Nuevo contrato de alquiler</CardTitle>
            <CardDescription>
              Registra un alquiler de bomba mixer con los datos básicos del cliente y equipo.
            </CardDescription>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
              <Badge variant="neutral">{abiertos.length} contratos activos</Badge>
              <Badge variant="neutral">{contratos.length} contratos registrados</Badge>
              <Badge variant="neutral">{maquinas.length} equipos disponibles</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canMutate ? (
              <AlquilerMixerContextPanels
                clientes={clientes}
                maquinas={maquinas}
                contratosAbiertos={abiertos}
                mockData={comboMock}
              />
            ) : (
              <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
                Tu rol es de solo lectura.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">Cerrar contrato:</span>{" "}
          Usa esta opción cuando el equipo ya fue devuelto o el servicio finalizó.
        </div>
      </Card>

      <Card>
        <CardTitle>Contratos registrados</CardTitle>
        <CardDescription>Historial de alquileres de bomba mixer.</CardDescription>
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

      <Card>
        <CardTitle>Resumen de apoyo</CardTitle>
        <CardDescription>Consulta estos datos después de revisar o registrar contratos.</CardDescription>
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
    </div>
  );
}
