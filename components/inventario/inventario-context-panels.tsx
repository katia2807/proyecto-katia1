"use client";

import {
  submitCreateInventarioProductoForm,
  submitCreateInventarioMovimientoForm,
  submitInventarioCompraRapidaForm,
  createUnidadMedida,
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
  unidadesExtra?: string[];
};

export function InventarioContextPanels({
  quick,
  productos,
  proveedores = [],
  mockData = false,
  unidadesExtra = [],
}: InventarioContextPanelsProps) {
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

  // Estado para unidades de medida personalizadas en nuevo producto
  const [unidadesExtraState, setUnidadesExtraState] = useState<string[]>([]);
  const [nuevaUnidadInput, setNuevaUnidadInput] = useState("");
  const [showNuevaUnidad, setShowNuevaUnidad] = useState(false);
  const [selectedUnidad, setSelectedUnidad] = useState("");
  const nuevaUnidadRef = useRef<HTMLInputElement>(null);

  const UNIDADES_BASE = useMemo(() => [
    "unidad",
    "caja",
    "lata",
    "litro",
    "galón",
    "pie tablar",
    "m2",
    "m3",
    "kg",
    "bolsa",
  ], []);

  const todasLasUnidades = useMemo(() => {
    return Array.from(new Set([...UNIDADES_BASE, ...unidadesExtraState]));
  }, [UNIDADES_BASE, unidadesExtraState]);

  useEffect(() => {
    if (unidadesExtra) {
      setUnidadesExtraState(unidadesExtra);
    }
  }, [unidadesExtra]);

  async function handleAgregarUnidad() {
    const valor = nuevaUnidadInput.trim();
    if (!valor) return;
    if (todasLasUnidades.map((u) => u.toLowerCase()).includes(valor.toLowerCase())) {
      setSelectedUnidad(valor);
      setShowNuevaUnidad(false);
      setNuevaUnidadInput("");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("nombre", valor);
      const res = await createUnidadMedida(formData);
      
      if (res && !res.ok) {
        showToast({ variant: "error", message: res.error || "Error al guardar la unidad de medida." });
        return;
      }
      
      setUnidadesExtraState((prev) => [...prev, valor]);
      setSelectedUnidad(valor);
      setNuevaUnidadInput("");
      setShowNuevaUnidad(false);
    } catch (e) {
      showToast({ variant: "error", message: e instanceof Error ? e.message : "Error al guardar la unidad de medida." });
    }
  }

  useEffect(() => {
    if (showNuevaUnidad && nuevaUnidadRef.current) {
      nuevaUnidadRef.current.focus();
    }
  }, [showNuevaUnidad]);

  // Combobox proveedor y errores
  const [compraProveedor, setCompraProveedor] = useState("");
  const proveedorOptions = useMemo(() => {
    return proveedores.map((p) => ({ value: p.nombre, label: p.nombre }));
  }, [proveedores]);

  const [compraErrors, setCompraErrors] = useState<{ producto_id?: string; cantidad?: string }>({});
  const [movimientoErrors, setMovimientoErrors] = useState<{ producto_id?: string; cantidad?: string }>({});

  const handleCompraSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const errors: { producto_id?: string; cantidad?: string } = {};
    if (!productoCompraId) {
      errors.producto_id = "Debe seleccionar un producto.";
    }
    const qty = parseFloat(cantidadCubicada);
    if (!cantidadCubicada || isNaN(qty) || qty <= 0) {
      errors.cantidad = "La cantidad debe ser mayor a 0.";
    }
    if (Object.keys(errors).length > 0) {
      e.preventDefault();
      setCompraErrors(errors);
      return;
    }
    setCompraErrors({});
  };

  const handleMovimientoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const errors: { producto_id?: string; cantidad?: string } = {};
    if (!productoMovId) {
      errors.producto_id = "Debe seleccionar un producto.";
    }
    const qtyVal = (e.currentTarget.elements.namedItem("cantidad") as HTMLInputElement)?.value;
    const qty = parseFloat(qtyVal);
    if (!qtyVal || isNaN(qty) || qty <= 0) {
      errors.cantidad = "La cantidad debe ser mayor a 0.";
    }
    if (Object.keys(errors).length > 0) {
      e.preventDefault();
      setMovimientoErrors(errors);
      return;
    }
    setMovimientoErrors({});
  };

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
      setCompraProveedor("");
      setCompraErrors({});
      setShowCubicaje(false);
      setCantidadCubicada("");
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
      setSelectedUnidad("");
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
      setMovimientoErrors({});
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
            setCompraProveedor("");
            setCompraErrors({});
            setShowCubicaje(false);
            setCantidadCubicada("");
          }
        }}
      >
        <form key={compraFormKey} action={compraFormAction} onSubmit={handleCompraSubmit} className="grid gap-3 md:grid-cols-2">
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
            {compraErrors.producto_id && (
              <p className="text-xs text-red-500 mt-1">{compraErrors.producto_id}</p>
            )}
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

          <div className="flex flex-col gap-1.5">
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
            {compraErrors.cantidad && (
              <p className="text-xs text-red-500 mt-1">{compraErrors.cantidad}</p>
            )}
          </div>
          <Field
            name="costo_unitario"
            label="Costo unitario compra (opcional)"
            type="number"
            min="0"
            step="0.01"
          />

          {/* Campo Proveedor como Combobox Real con allowFreeText */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Proveedor (opcional)
            </label>
            <Combobox
              options={proveedorOptions}
              value={compraProveedor}
              onChange={setCompraProveedor}
              hiddenInputName="proveedor"
              placeholder="Buscar proveedor o escribir nombre…"
              inputAriaLabel="Proveedor para registrar compra"
              allowFreeText={true}
            />
            <p className="text-xs text-[var(--color-text-secondary)]">
              Podés elegir de la lista o escribir un nombre nuevo.
            </p>
          </div>

          <Field name="fecha" type="date" label="Fecha" required defaultValue={new Date().toISOString().split("T")[0]} />
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
            setSelectedUnidad("");
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
                className="flex items-center gap-1 rounded-xl border border-[var(--color-op-primary-border)] bg-[var(--color-op-primary-bg)] px-2.5 py-2 text-xs font-semibold text-[var(--color-op-primary-text)] transition hover:bg-[var(--color-op-primary-hover)]"
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
                  className="rounded-xl border border-[var(--color-op-success-border)] bg-[var(--color-op-success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-op-success-text)] hover:bg-[var(--color-op-success-hover)] transition"
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
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-op-primary-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-op-primary-text)] border border-[var(--color-op-primary-border)]"
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
                      className="ml-1 text-[var(--color-op-primary-text)] opacity-70 hover:opacity-100 transition-opacity"
                      title={`Eliminar categoría ${cat}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Selector de unidad de medida con botón para agregar nueva */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Unidad <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <select
                name="unidad"
                required
                value={selectedUnidad}
                onChange={(e) => setSelectedUnidad(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">Seleccionar…</option>
                {todasLasUnidades.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Agregar nueva unidad"
                onClick={() => setShowNuevaUnidad((v) => !v)}
                className="flex items-center gap-1 rounded-xl border border-[var(--color-op-primary-border)] bg-[var(--color-op-primary-bg)] px-2.5 py-2 text-xs font-semibold text-[var(--color-op-primary-text)] transition hover:bg-[var(--color-op-primary-hover)]"
              >
                <span>+ Nueva</span>
              </button>
            </div>

            {showNuevaUnidad && (
              <div className="flex gap-2 items-center mt-1">
                <input
                  ref={nuevaUnidadRef}
                  type="text"
                  value={nuevaUnidadInput}
                  onChange={(e) => setNuevaUnidadInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAgregarUnidad(); }
                    if (e.key === "Escape") { setShowNuevaUnidad(false); setNuevaUnidadInput(""); }
                  }}
                  placeholder="Nombre de la unidad"
                  className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <button
                  type="button"
                  onClick={handleAgregarUnidad}
                  className="rounded-xl border border-[var(--color-op-success-border)] bg-[var(--color-op-success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-op-success-text)] hover:bg-[var(--color-op-success-hover)] transition"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNuevaUnidad(false); setNuevaUnidadInput(""); }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] transition"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

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
            setMovimientoErrors({});
          }
        }}
        replacePathOnClose="/inventario"
      >
        <form key={movimientoFormKey} action={movimientoFormAction} onSubmit={handleMovimientoSubmit} className="grid gap-3 md:grid-cols-2">
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
            {movimientoErrors.producto_id && (
              <p className="text-xs text-red-500 mt-1">{movimientoErrors.producto_id}</p>
            )}
          </label>
          <Field name="fecha" type="date" label="Fecha" required defaultValue={new Date().toISOString().split("T")[0]} />
          <SelectField name="tipo" label="Tipo" defaultValue="entrada_compra" required>
            <option value="entrada_compra">Entrada por compra</option>
            <option value="salida_venta">Salida por venta</option>
            <option value="ajuste">Ajuste</option>
          </SelectField>
          <div className="flex flex-col gap-1.5">
            <Field name="cantidad" label="Cantidad" type="number" min="0.01" step="0.01" required />
            {movimientoErrors.cantidad && (
              <p className="text-xs text-red-500 mt-1">{movimientoErrors.cantidad}</p>
            )}
          </div>
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
