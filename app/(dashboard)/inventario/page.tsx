import { Suspense } from "react";
import { InventarioAccionesRapidas } from "@/components/inventario-acciones-rapidas";
import { InventarioContextPanels } from "@/components/inventario/inventario-context-panels";
import { InventarioInteractivo } from "@/components/inventario-interactivo";
import { MetricCard } from "@/components/metric-card";
import { getDashboardSession } from "@/lib/current-user-role";
import { getInventarioRobustoData, getMueblesCatalogoRows, getProveedoresRows } from "@/lib/data";
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
  const sp = (await searchParams) ?? {};
  const quick = normalizeQuickParam(sp.quick);
  const [inventario, mueblesCatalogo, proveedores] = await Promise.all([
    getInventarioRobustoData(),
    getMueblesCatalogoRows(true),
    getProveedoresRows(),
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
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">
          Inventario
        </h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Catálogo de productos con stock, alertas, movimientos y valorización en tiempo real.
        </p>
      </div>

      {loadWarning ? (
        <div role="alert" className="rounded-[var(--katia-radius-md)] border border-[var(--katia-warning)]/40 bg-[var(--katia-warning)]/10 px-4 py-3 text-sm font-medium text-[var(--katia-warning)]">
          {loadWarning}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Productos activos"
          value={String(inventarioData.indicadores.totalProductosActivos)}
          hint="Productos disponibles en catalogo interno."
        />
        <MetricCard
          label="Con stock bajo"
          value={String(inventarioData.indicadores.productosConStockBajo)}
          hint="Revisar y reponer para evitar quiebres."
        />
        <MetricCard
          label="Movimientos del mes"
          value={String(inventarioData.indicadores.movimientosDelMes ?? 0)}
          hint={`${inventarioData.indicadores.totalMovimientos} movimientos historicos cargados.`}
        />
      </div>

      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]" aria-hidden />}>
        <InventarioAccionesRapidas
          canMutate={canMutate}
          noPermisoHint={
            <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
              Tu rol no tiene permisos de escritura en inventario.
            </p>
          }
        >
          <InventarioContextPanels
            quick={quick}
            productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
            proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
            mockData={comboMock}
          />
        </InventarioAccionesRapidas>
      </Suspense>

      <Suspense fallback={<div className="min-h-[28rem] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]" aria-hidden />}>
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
      </Suspense>
    </div>
  );
}
