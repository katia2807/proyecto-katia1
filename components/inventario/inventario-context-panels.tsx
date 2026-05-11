"use client";

import { createInventarioMovimiento, createInventarioProducto } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { Field, SelectField } from "@/components/ui/field";
import { MOCK_INVENTARIO_PRODUCTOS } from "@/lib/combobox-mocks";
import { useMemo, useState } from "react";

type ProductoOpt = { id: string; nombre: string };

type InventarioContextPanelsProps = {
  quick: string;
  productos: ProductoOpt[];
  mockData?: boolean;
};

export function InventarioContextPanels({ quick, productos, mockData = false }: InventarioContextPanelsProps) {
  const [productoMovId, setProductoMovId] = useState("");

  const effectiveProductos = useMemo((): ProductoOpt[] => {
    if (!mockData) return productos;
    return MOCK_INVENTARIO_PRODUCTOS.map((p) => ({ id: p.id, nombre: p.nombre }));
  }, [mockData, productos]);

  const productoOptions = useMemo(
    () =>
      effectiveProductos.map((p) => ({
        value: p.id,
        label: p.nombre,
      })),
    [effectiveProductos],
  );

  return (
    <>
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
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Producto</span>
            <Combobox
              options={productoOptions}
              value={productoMovId}
              onChange={setProductoMovId}
              hiddenInputName="producto_id"
              placeholder="Buscar producto…"
              inputAriaLabel="Producto para movimiento de inventario"
            />
          </label>
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
    </>
  );
}
