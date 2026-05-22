"use client";

import {
  submitCreateInventarioProductoForm,
  submitCreateInventarioMovimientoForm,
  submitInventarioCompraRapidaForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { CubicajeInput } from "@/components/sales/cubicaje-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { useToast } from "@/components/ui/toast";
import { Field, SelectField } from "@/components/ui/field";
import { MOCK_INVENTARIO_PRODUCTOS } from "@/lib/combobox-mocks";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { IconArrowsLeftRight, IconCirclePlus, IconShoppingCart } from "@tabler/icons-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CodigoProductoPreview } from "@/components/inventario/codigo-producto-preview";
import { FotoUpload } from "@/components/sales/foto-upload";

type ProductoOpt = { id: string; nombre: string };
type ProveedorOpt = { id: string; nombre: string };

const CATEGORIAS_BASE = [
  "Madera",
  "Tornillería",
  "Barnices y Químicos",
  "Muebles",
  "Servicio",
  "Herramientas",
  "Accesorios",
  "Otro",
];

type InventarioContextPanelsProps = {
  quick: string;
  productos: ProductoOpt[];
  proveedores?: ProveedorOpt[];
  mockData?: boolean;
};

export function InventarioContextPanels({ quick, productos, proveedores = [], mockData = false }: InventarioContextPanelsProps) {
  const searchParams = useSearchParams();
  const [productoMovId, setProductoMovId] = useState("");
  const [productoCompraId, setProductoCompraId] = useState("");

  const [stockInicial, setStockInicial] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const costoTotalActual = useMemo(() => {
    const qty = parseFloat(stockInicial);
    const unit = parseFloat(costoUnitario);
    if (isNaN(qty) || isNaN(unit)) return 0;
    return qty * unit;
  }, [stockInicial, costoUnitario]);
  
  const [openCompra, setOpenCompra] = useState(quick === "compra");
  const [compraFormKey, setCompraFormKey] = useState(0);
  const [compraState, compraFormAction] = useActionState(submitInventarioCompraRapidaForm, mutationFormInitialState);

  const [openProducto, setOpenProducto] = useState(quick === "producto");
  const [productoFormKey, setProductoFormKey] = useState(0);
  const [productoState, productoFormAction] = useActionState(submitCreateInventarioProductoForm, mutationFormInitialState);

  const [openMovimiento, setOpenMovimiento] = useState(quick === "movimiento");
  const [movimientoFormKey, setMovimientoFormKey] = useState(0);
  const [movimientoState, movimientoFormAction] = useActionState(submitCreateInventarioMovimientoForm, mutationFormInitialState);

  const [showCubicaje, setShowCubicaje] = useState(false);
  const [cantidadCubicada, setCantidadCubicada] = useState("");
  const { showToast } = useToast();

  // Estado para categorías personalizadas en nuevo producto
  const [categoriasExtra, setCategoriasExtra] = useState<string[]>([]);
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState("");
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState("");
  const nuevaCategoriaRef = useRef<HTMLInputElement>(null);

  const todasLasCategorias = useMemo(() => {
    return [...CATEGORIAS_BASE, ...categoriasExtra];
  }, [categoriasExtra]);

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
    if (quick === "compra") setOpenCompra(true);
    if (quick === "producto") setOpenProducto(true);
    if (quick === "movimiento") setOpenMovimiento(true);
  }, [quick]);

  useEffect(() => {
    const q = searchParams.get("quick");
    const pid = searchParams.get("producto_id")?.trim();
    if (q === "compra") {
      setOpenCompra(true);
      if (pid && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pid)) {
        setProductoCompraId(pid);
      }
    } else if (q === "producto") {
      setOpenProducto(true);
    } else if (q === "movimiento") {
      setOpenMovimiento(true);
      if (pid && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pid)) {
        setProductoMovId(pid);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (compraState.success && compraState.message) {
      showToast({ variant: "success", message: compraState.message });
      setOpenCompra(false);
      setCompraFormKey((k) => k + 1);
      setProductoCompraId("");
    } else if (compraState.error) {
      showToast({ variant: "error", message: compraState.error });
    }
  }, [compraState, showToast]);

  useEffect(() => {
    if (productoState.success && productoState.message) {
      showToast({ variant: "success", message: productoState.message });
      setOpenProducto(false);
      setProductoFormKey((k) => k + 1);
      setSelectedCategoria("");
      setStockInicial("");
      setCostoUnitario("");
    } else if (productoState.error) {
      showToast({ variant: "error", message: productoState.error });
    }
  }, [productoState, showToast]);

  useEffect(() => {
    if (movimientoState.success && movimientoState.message) {
      showToast({ variant: "success", message: movimientoState.message });
      setOpenMovimiento(false);
      setMovimientoFormKey((k) => k + 1);
      setProductoMovId("");
    } else if (movimientoState.error) {
      showToast({ variant: "error", message: movimientoState.error });
    }
  }, [movimientoState, showToast]);

  function handleAgregarCategoria() {
    const valor = nuevaCategoriaInput.trim();
    if (!valor) return;
    if (todasLasCategorias.map((c) => c.toLowerCase()).includes(valor.toLowerCase())) {
      setSelectedCategoria(valor);
      setShowNuevaCategoria(false);
      setNuevaCategoriaInput("");
      return;
    }
    setCategoriasExtra((prev) => [...prev, valor]);
    setSelectedCategoria(valor);
    setNuevaCategoriaInput("");
    setShowNuevaCategoria(false);
  }

  useEffect(() => {
    if (showNuevaCategoria && nuevaCategoriaRef.current) {
      nuevaCategoriaRef.current.focus();
    }
  }, [showNuevaCategoria]);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar compra"
        triggerIcon={<IconShoppingCart aria-hidden />}
        triggerClassName="border border-[var(--color-op-success-border)] bg-[var(--color-op-success-bg)] text-[var(--color-op-success-text)] hover:bg-[var(--color-op-success-hover)] hover:brightness-105"
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

          {/* Cubicaje toggle — útil para compras de madera */}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => {
                setShowCubicaje((v) => !v);
                setCantidadCubicada("");
              }}
              className="text-xs font-semibold text-[var(--color-accent)] underline underline-offset-2"
            >
              {showCubicaje ? "▲ Ocultar calculadora de cubicaje" : "📐 Usar calculadora de cubicaje (madera)"}
            </button>
          </div>

          {showCubicaje ? (
            <div className="md:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                Calculadora de cubicaje — el total en PT se copiará al campo &quot;Cantidad&quot;
              </p>
              <CubicajeInput
                name="cubicaje_lineas"
                totalPtName="cubicaje_total_pt"
                totalM3Name="cubicaje_total_m3"
                precioEditable={false}
              />
              <button
                type="button"
                onClick={() => {
                  const ptInput = document.querySelector<HTMLInputElement>('input[name="cubicaje_total_pt"]');
                  const pt = ptInput?.value ?? "";
                  setCantidadCubicada(pt);
                }}
                className="mt-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                ← Copiar {cantidadCubicada ? `${parseFloat(cantidadCubicada).toFixed(2)} PT` : "total PT"} a cantidad
              </button>
            </div>
          ) : null}

          <Field
            name="cantidad"
            label="Cantidad recibida"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={cantidadCubicada || undefined}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCantidadCubicada(e.target.value)}
          />
          <Field
            name="costo_unitario"
            label="Costo unitario compra (opcional)"
            type="number"
            min="0"
            step="0.01"
          />

          {/* Campo Proveedor como texto + lista de sugerencias (datalist) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="compra-proveedor-input" className="text-sm font-medium text-[var(--color-text-primary)]">
              Proveedor (opcional)
            </label>
            <input
              id="compra-proveedor-input"
              name="proveedor"
              type="text"
              list={proveedores.length > 0 ? "compra-proveedores-list" : undefined}
              placeholder={proveedores.length > 0 ? "Buscar proveedor o escribir nombre…" : "Texto libre"}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-surface-2))] px-3 text-sm text-[var(--color-text-primary)] outline-none shadow-[var(--shadow-soft)] focus-visible:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {proveedores.length > 0 && (
              <datalist id="compra-proveedores-list">
                {proveedores.map((p) => (
                  <option key={p.id} value={p.nombre} />
                ))}
              </datalist>
            )}
            {proveedores.length > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Podés elegir de la lista o escribir un nombre nuevo.
              </p>
            )}
          </div>

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
        triggerClassName="border border-[var(--color-op-primary-border)] bg-[var(--color-op-primary-bg)] text-[var(--color-op-primary-text)] hover:bg-[var(--color-op-primary-hover)] hover:brightness-105"
        title="Nuevo producto"
        description="Completa solo lo necesario para registrarlo."
        open={openProducto}
        onOpenChange={(next) => {
          setOpenProducto(next);
          if (!next) {
            setProductoFormKey((k) => k + 1);
            setSelectedCategoria("");
            setStockInicial("");
            setCostoUnitario("");
          }
        }}
        replacePathOnClose="/inventario"
      >
        <form key={productoFormKey} action={productoFormAction} className="grid gap-3 md:grid-cols-2">
          {/* Nombre + código con sugerencia automática */}
          <CodigoProductoPreview />

          {/* Selector de categoría con botón para agregar nueva */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Categoría <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <select
                name="categoria"
                required
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">Seleccionar…</option>
                {todasLasCategorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Agregar nueva categoría"
                onClick={() => setShowNuevaCategoria((v) => !v)}
                className="flex items-center gap-1 rounded-xl border border-violet-500/40 bg-violet-500/15 px-2.5 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/25"
              >
                <span>+ Nueva</span>
              </button>
            </div>

            {showNuevaCategoria && (
              <div className="flex gap-2 items-center mt-1">
                <input
                  ref={nuevaCategoriaRef}
                  type="text"
                  value={nuevaCategoriaInput}
                  onChange={(e) => setNuevaCategoriaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAgregarCategoria(); }
                    if (e.key === "Escape") { setShowNuevaCategoria(false); setNuevaCategoriaInput(""); }
                  }}
                  placeholder="Nombre de la categoría"
                  className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <button
                  type="button"
                  onClick={handleAgregarCategoria}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNuevaCategoria(false); setNuevaCategoriaInput(""); }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] transition"
                >
                  ✕
                </button>
              </div>
            )}

            {categoriasExtra.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoriasExtra.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-300 border border-violet-500/20"
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => {
                        setCategoriasExtra((prev) => prev.filter((c) => c !== cat));
                        if (selectedCategoria === cat) {
                          setSelectedCategoria("");
                        }
                      }}
                      className="ml-1 text-violet-400 hover:text-violet-250 transition-colors"
                      title={`Eliminar categoría ${cat}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

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
          <Field
            name="stock_inicial"
            label="Stock inicial (opcional)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={stockInicial}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStockInicial(e.target.value)}
          />
          <Field
            name="costo_unitario"
            label="Costo por unidad (S/) (opcional)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={costoUnitario}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCostoUnitario(e.target.value)}
          />
          <div className="md:col-span-2 flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Costo total actual (autocalculado)</span>
            <div className="h-10 flex items-center rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] bg-[var(--bg-primary)] px-3 text-sm font-semibold text-[var(--color-accent)] opacity-80 shadow-[var(--shadow-soft)]">
              S/ {costoTotalActual.toFixed(2)}
            </div>
          </div>
          <div className="md:col-span-2">
            <FotoUpload
              bucket="muebles"
              name="foto_url"
              label={selectedCategoria === "Muebles" ? "Foto del mueble (Muy sugerido)" : "Foto del producto (Opcional)"}
            />
          </div>
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
        triggerClassName="border border-[var(--color-op-info-border)] bg-[var(--color-op-info-bg)] text-[var(--color-op-info-text)] hover:bg-[var(--color-op-info-hover)] hover:brightness-105"
        title="Movimiento de inventario"
        description="Entrada, salida o ajuste en un panel puntual."
        open={openMovimiento}
        onOpenChange={(next) => {
          setOpenMovimiento(next);
          if (!next) {
            setMovimientoFormKey((k) => k + 1);
            setProductoMovId("");
          }
        }}
        replacePathOnClose="/inventario"
      >
        <form key={movimientoFormKey} action={movimientoFormAction} className="grid gap-3 md:grid-cols-2">
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
