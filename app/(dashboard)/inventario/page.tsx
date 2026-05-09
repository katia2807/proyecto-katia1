import {
  createInventarioMovimiento,
  createInventarioProducto,
  deleteInventarioMovimiento,
  registrarConteoInventario,
  toggleInventarioProductoActivo,
  updateInventarioProducto,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { InventarioAccionesRapidas } from "@/components/inventario-acciones-rapidas";
import { InventarioInteractivo } from "@/components/inventario-interactivo";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { getInventarioRobustoData } from "@/lib/data";
import { canMutateInventario } from "@/lib/permissions";

type InventarioPageProps = {
  searchParams?: Promise<{ quick?: string | string[] }>;
};

function normalizeQuickParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function InventarioPage({ searchParams }: InventarioPageProps) {
  const quick = normalizeQuickParam((await searchParams)?.quick);
  const inventario = await getInventarioRobustoData();
  const { productos } = inventario;
  const role = await getCurrentUserRole();
  const canMutate = canMutateInventario(role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Inventario</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Vista visual primero. Abre acciones solo cuando las necesites.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Productos activos"
          value={String(inventario.indicadores.totalProductosActivos)}
          hint="Productos disponibles en catálogo interno."
        />
        <MetricCard
          label="Con stock bajo"
          value={String(inventario.indicadores.productosConStockBajo)}
          hint="Revisar y reponer para evitar quiebres."
        />
        <MetricCard
          label="Movimientos registrados"
          value={String(inventario.indicadores.totalMovimientos)}
          hint={`Valorización actual: S/ ${inventario.indicadores.valorInventario.toFixed(2)}`}
        />
      </div>

      <InventarioAccionesRapidas
        canMutate={canMutate}
        noPermisoHint={
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Tu rol no tiene permisos de escritura en inventario.
          </p>
        }
      >
          <ContextActionPanel
            key={`quick-producto-${quick}`}
            triggerLabel="Agregar producto"
            title="Nuevo producto"
            description="Completa solo lo necesario para registrarlo."
            openByDefault={quick === "producto"}
            replacePathOnClose="/inventario"
          >
            <form action={createInventarioProducto} className="grid gap-3 md:grid-cols-2">
              <Field name="codigo" label="Código" placeholder="MAD-TOR-01" required />
              <Field name="nombre" label="Nombre" placeholder="Tabla Tornillo 2x10x240" required />
              <Field name="categoria" label="Categoría" placeholder="Madera" required />
              <Field name="unidad" label="Unidad" placeholder="unidad / caja / lata" required />
              <Field
                name="stock_minimo"
                label="Stock mínimo"
                type="number"
                min="0"
                step="1"
                required
                className="md:col-span-2"
              />
              <input type="hidden" name="return_to" value="/inventario" />
              <input type="hidden" name="next_quick" value="movimiento" />
              <div className="md:col-span-2">
                <Button>Guardar producto</Button>
              </div>
            </form>
          </ContextActionPanel>

          <ContextActionPanel
            key={`quick-movimiento-${quick}`}
            triggerLabel="Registrar movimiento"
            title="Movimiento de inventario"
            description="Entrada, salida o ajuste en un panel puntual."
            openByDefault={quick === "movimiento"}
            replacePathOnClose="/inventario"
          >
            <form action={createInventarioMovimiento} className="grid gap-3 md:grid-cols-2">
              <SelectField name="producto_id" label="Producto" required defaultValue="">
                <option value="" disabled>
                  Selecciona producto
                </option>
                {productos.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </option>
                ))}
              </SelectField>
              <Field name="fecha" type="date" label="Fecha" required />
              <SelectField name="tipo" label="Tipo" defaultValue="entrada_compra" required>
                <option value="entrada_compra">Entrada por compra</option>
                <option value="salida_venta">Salida por venta</option>
                <option value="ajuste">Ajuste</option>
              </SelectField>
              <Field name="cantidad" label="Cantidad" type="number" min="0.01" step="0.01" required />
              <Field name="costo_unitario" label="Costo unitario (opcional)" type="number" min="0" step="0.01" />
              <Field name="referencia" label="Referencia" placeholder="Factura, pedido, ajuste..." />
              <input type="hidden" name="return_to" value="/inventario" />
              <div className="md:col-span-2">
                <Button>Guardar movimiento</Button>
              </div>
            </form>
          </ContextActionPanel>
      </InventarioAccionesRapidas>

      <InventarioInteractivo
        data={inventario}
        canMutate={canMutate}
        actions={{
          updateInventarioProducto,
          toggleInventarioProductoActivo,
          deleteInventarioMovimiento,
          registrarConteoInventario,
        }}
      />
    </div>
  );
}
