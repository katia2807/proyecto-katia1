"use client";

import {
  createInventarioMovimiento,
  createInventarioProducto,
  submitInventarioCompraRapidaForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { useToast } from "@/components/ui/toast";
import { Field, SelectField } from "@/components/ui/field";
import { MOCK_INVENTARIO_PRODUCTOS } from "@/lib/combobox-mocks";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { IconArrowsLeftRight, IconCirclePlus, IconShoppingCart } from "@tabler/icons-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CodigoProductoPreview } from "@/components/inventario/codigo-producto-preview";

type ProductoOpt = { id: string; nombre: string };

type InventarioContextPanelsProps = {
  quick: string;
  productos: ProductoOpt[];
  mockData?: boolean;
};

export function InventarioContextPanels({ quick, productos, mockData = false }: InventarioContextPanelsProps) {
  const searchParams = useSearchParams();
  const [productoMovId, setProductoMovId] = useState("");
  const [productoCompraId, setProductoCompraId] = useState("");
  const [openCompra, setOpenCompra] = useState(quick === "compra");
  const [compraFormKey, setCompraFormKey] = useState(0);
  const { showToast } = useToast();
  const [compraState, compraFormAction] = useActionState(submitInventarioCompraRapidaForm, mutationFormInitialState);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (quick === "compra") setOpenCompra(true);
  }, [quick]);

  useEffect(() => {
    const q = searchParams.get("quick");
    const pid = searchParams.get("producto_id")?.trim();
    if (q === "compra") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenCompra(true);
      if (pid && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pid)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProductoCompraId(pid);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (compraState.success && compraState.message) {
      showToast({ variant: "success", message: compraState.message });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenCompra(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompraFormKey((k) => k + 1);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProductoCompraId("");
    } else if (compraState.error) {
      showToast({ variant: "error", message: compraState.error });
    }
  }, [compraState, showToast]);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar compra"
        triggerIcon={<IconShoppingCart aria-hidden />}
        triggerClassName="border border-emerald-500/45 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25 hover:brightness-105"
        title="Registrar compra"
        description="Registra mercadería entrante y, si corresponde, egreso de caja por la compra."
        open={openCompra}
        replacePathOnClose="/inventario"
        onOpenChange={(next) => {
          setOpenCompra(next);
          if (!next) {
            setCompraFormKey((k) => k + 1);
            setProductoCompraId("");
          }
        }}
      >
        <form key={compraFormKey} action={compraFormAction} className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)] md:col-span-2">
            <span>Producto</span>
            <Combobox
              options={productoOptions}
              value={productoCompraId}
              onChange={setProductoCompraId}
              hiddenInputName="producto_id"
              placeholder="Buscar producto…"
              inputAriaLabel="Producto para registrar compra"
            />
          </label>
          <Field name="cantidad" label="Cantidad recibida" type="number" min="0.01" step="0.01" required />
          <Field
            name="costo_unitario"
            label="Costo unitario compra (opcional)"
            type="number"
            min="0"
            step="0.01"
          />
          <Field name="proveedor" label="Proveedor (opcional)" placeholder="Texto libre" />
          <Field name="fecha" type="date" label="Fecha" required />
          <Field className="md:col-span-2" name="nota" label="Nota (opcional)" placeholder="Observación de la compra" />
          <div className="md:col-span-2">
            <Button>Guardar compra</Button>
          </div>
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        key={`quick-producto-${quick}`}
        triggerLabel="Agregar producto"
        triggerIcon={<IconCirclePlus aria-hidden />}
        triggerClassName="border border-violet-500/45 bg-violet-500/15 text-violet-50 hover:bg-violet-500/25 hover:brightness-105"
        title="Nuevo producto"
        description="Completa solo lo necesario para registrarlo."
        openByDefault={quick === "producto"}
        replacePathOnClose="/inventario"
      >
        <form action={createInventarioProducto} className="grid gap-3 md:grid-cols-2">
          {/* Nombre + código con sugerencia automática */}
          <CodigoProductoPreview />

          <SelectField name="categoria" label="Categoría" required>
            <option value="">Seleccionar…</option>
            <option value="Madera">Madera</option>
            <option value="Tornillería">Tornillería / Ferretería</option>
            <option value="Barnices y Químicos">Barnices y Químicos</option>
            <option value="Muebles">Muebles</option>
            <option value="Servicio">Servicio</option>
            <option value="Herramientas">Herramientas</option>
            <option value="Accesorios">Accesorios</option>
            <option value="Otro">Otro</option>
          </SelectField>
          <SelectField name="unidad" label="Unidad" required>
            <option value="">Seleccionar…</option>
            <option value="unidad">Unidad</option>
            <option value="caja">Caja</option>
            <option value="lata">Lata</option>
            <option value="litro">Litro</option>
            <option value="galón">Galón</option>
            <option value="pie tablar">Pie tablar</option>
            <option value="m2">m²</option>
            <option value="m3">m³</option>
            <option value="kg">kg</option>
            <option value="bolsa">Bolsa</option>
          </SelectField>
          <Field
            name="stock_minimo"
            label="Stock mínimo de alerta"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            required
            className="md:col-span-2"
          />
          <input type="hidden" name="return_to" value="/inventario" />
          <input type="hidden" name="next_quick" value="movimiento" />
          <div className="md:col-span-2 flex gap-2">
            <Button>Guardar y agregar movimiento</Button>
          </div>
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        key={`quick-movimiento-${quick}`}
        triggerLabel="Registrar movimiento"
        triggerIcon={<IconArrowsLeftRight aria-hidden />}
        triggerClassName="border border-sky-500/45 bg-sky-500/15 text-sky-50 hover:bg-sky-500/25 hover:brightness-105"
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
