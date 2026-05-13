import { Suspense } from "react";
import { InventarioAccionesRapidas } from "@/components/inventario-acciones-rapidas";
import { InventarioContextPanels } from "@/components/inventario/inventario-context-panels";
import { InventarioInteractivo } from "@/components/inventario-interactivo";
import { MetricCard } from "@/components/metric-card";
import { getDashboardSession } from "@/lib/current-user-role";
import { getInventarioRobustoData, getMueblesCatalogoRows } from "@/lib/data";
import { canMutateInventario } from "@/lib/permissions";

type InventarioPageProps = {
  searchParams?: Promise<{ quick?: string | string[] }>;
};

function normalizeQuickParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function InventarioPage({ searchParams }: InventarioPageProps) {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const quick = normalizeQuickParam((await searchParams)?.quick);
  const [inventario, mueblesCatalogo] = await Promise.all([
    getInventarioRobustoData(),
    getMueblesCatalogoRows(true),
  ]);
  const { loadWarning, ...inventarioData } = inventario;
  const { productos } = inventarioData;
  const session = await getDashboardSession();
  const role = session?.role ?? null;
  const uiRole = session?.uiRole ?? null;
  const canMutate = canMutateInventario(role, uiRole);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Inventario</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Vista visual primero. Abre acciones solo cuando las necesites.
        </p>
      </div>

      {loadWarning ? (
        <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
          {loadWarning}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Productos activos"
          value={String(inventarioData.indicadores.totalProductosActivos)}
          hint="Productos disponibles en catálogo interno."
        />
        <MetricCard
          label="Con stock bajo"
          value={String(inventarioData.indicadores.productosConStockBajo)}
          hint="Revisar y reponer para evitar quiebres."
        />
        <MetricCard
          label="Movimientos registrados"
          value={String(inventarioData.indicadores.totalMovimientos)}
          hint={`Valorización actual: S/ ${inventarioData.indicadores.valorInventario.toFixed(2)}`}
        />
      </div>

      <Suspense
        fallback={
          <div
            className="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]"
            aria-hidden
          />
        }
      >
        <InventarioAccionesRapidas
          canMutate={canMutate}
          noPermisoHint={
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Tu rol no tiene permisos de escritura en inventario.
            </p>
          }
        >
          <InventarioContextPanels
            quick={quick}
            productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
            mockData={comboMock}
          />
        </InventarioAccionesRapidas>
      </Suspense>

      <InventarioInteractivo
        data={inventarioData}
        canMutate={canMutate}
        mueblesCatalogo={mueblesCatalogo.map((m) => ({
          id: m.id,
          codigo: m.codigo,
          nombre: m.nombre,
          descripcion: m.descripcion,
          precio_lista: m.precio_lista,
          foto_url: m.foto_url,
          activo: m.activo,
        }))}
      />
    </div>
  );
}
