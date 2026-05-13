"use client";

import {
  deleteInventarioMovimiento,
  registrarConteoInventario,
  toggleInventarioProductoActivo,
  updateInventarioProducto,
} from "@/app/actions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";

type ProductoEnriched = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  activo: boolean;
  stock_actual: number;
  stock_minimo: number;
  vendido: number;
  ajustes: number;
  costo_unitario_promedio: number;
  valor_stock: number;
  dias_sin_movimiento: number | null;
  ultimo_movimiento: string | null;
};

type MovimientoRow = {
  id: string;
  fecha: string;
  tipo: "entrada_compra" | "salida_venta" | "ajuste";
  producto_id: string;
  cantidad: number;
  costo_unitario: number | null;
  referencia: string | null;
};

type KardexRow = MovimientoRow & {
  producto_codigo: string;
  producto_nombre: string;
  categoria: string;
  impacto: number;
};

type RankingRow = {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  sugerido_reponer: number;
};

type InventarioData = {
  productos: ProductoEnriched[];
  movimientos: MovimientoRow[];
  categorias: string[];
  stockBajo: ProductoEnriched[];
  sinMovimiento: ProductoEnriched[];
  reposicionSugerida: RankingRow[];
  rankingMasVendidos: ProductoEnriched[];
  rankingMenosVendidos: ProductoEnriched[];
  topAjustes: ProductoEnriched[];
  kardex: KardexRow[];
  indicadores: {
    totalProductosActivos: number;
    totalProductosInactivos: number;
    totalMovimientos: number;
    totalStock: number;
    valorInventario: number;
    rotacionPromedio: number;
    productosConStockBajo: number;
    productosSinMovimiento30d: number;
  };
};

type Props = {
  data: InventarioData;
  canMutate: boolean;
};

function ProductoIrAEdicion({
  nombre,
  productoId,
  onGo,
}: {
  nombre: string;
  productoId: string;
  onGo: (id: string) => void;
}) {
  return (
    <button
      type="button"
      title="Ir a edición en la pestaña Productos"
      className="-m-1 max-w-full rounded-md px-1 py-0.5 text-left text-[var(--color-text-primary)] underline-offset-2 hover:bg-[var(--color-primary-soft)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      onClick={() => onGo(productoId)}
    >
      <span className="font-medium">{nombre}</span>
    </button>
  );
}

export function InventarioInteractivo({
  data,
  canMutate,
}: Props) {
  const {
    productos,
    categorias,
    stockBajo,
    sinMovimiento,
    reposicionSugerida,
    rankingMasVendidos,
    rankingMenosVendidos,
    topAjustes,
    kardex,
    indicadores,
  } = data;
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"resumen" | "productos" | "kardex" | "alertas" | "reportes">("resumen");
  const [filterText, setFilterText] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activos" | "inactivos" | "stock_bajo">("todos");
  const [kardexTipo, setKardexTipo] = useState<"todos" | "entrada_compra" | "salida_venta" | "ajuste">("todos");
  const [kardexProducto, setKardexProducto] = useState("todos");
  const [pendingFocusProductoId, setPendingFocusProductoId] = useState<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const focusProducto = useCallback((productoId: string) => {
    const row = document.getElementById(`producto-${productoId}`);
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(productoId);

    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      setHighlightedId(null);
    }, 3500);
  }, []);

  const goToProductoEditor = useCallback(
    (productoId: string) => {
      setActiveTab("productos");
      setPendingFocusProductoId(productoId);
      try {
        window.history.replaceState(null, "", `#producto-${productoId}`);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash?.replace(/^#/, "") ?? "";
    const m = /^producto-(.+)$/.exec(raw);
    if (m?.[1]) {
      setActiveTab("productos");
      setPendingFocusProductoId(m[1]);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "productos" || !pendingFocusProductoId) return;
    const id = pendingFocusProductoId;
    const frame = window.requestAnimationFrame(() => {
      focusProducto(id);
      setPendingFocusProductoId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, pendingFocusProductoId, focusProducto]);

  const productosFiltrados = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return productos.filter((p) => {
      if (filterCategoria !== "todas" && p.categoria !== filterCategoria) return false;
      if (filterEstado === "activos" && p.activo === false) return false;
      if (filterEstado === "inactivos" && p.activo !== false) return false;
      if (filterEstado === "stock_bajo" && Number(p.stock_actual) > Number(p.stock_minimo)) return false;
      if (!q) return true;
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      );
    });
  }, [filterCategoria, filterEstado, filterText, productos]);

  const kardexFiltrado = useMemo(() => {
    return kardex.filter((k) => {
      if (kardexTipo !== "todos" && k.tipo !== kardexTipo) return false;
      if (kardexProducto !== "todos" && k.producto_id !== kardexProducto) return false;
      return true;
    });
  }, [kardex, kardexProducto, kardexTipo]);

  const tabBtnClass = (key: typeof activeTab) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-semibold transition",
      activeTab === key
        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
        : "border-[var(--color-border)] bg-[var(--color-primary-soft)] text-[var(--color-text-primary)]",
    );

  return (
    <>
      <Card>
        <CardTitle>Centro de control de inventario</CardTitle>
        <CardDescription>Gestiona catálogo, kardex, conteos, alertas y reportes desde una sola vista.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={tabBtnClass("resumen")} onClick={() => setActiveTab("resumen")}>Resumen</button>
          <button type="button" className={tabBtnClass("productos")} onClick={() => setActiveTab("productos")}>Productos</button>
          <button type="button" className={tabBtnClass("kardex")} onClick={() => setActiveTab("kardex")}>Kardex</button>
          <button type="button" className={tabBtnClass("alertas")} onClick={() => setActiveTab("alertas")}>Alertas</button>
          <button type="button" className={tabBtnClass("reportes")} onClick={() => setActiveTab("reportes")}>Reportes</button>
        </div>
      </Card>

      {activeTab === "resumen" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardTitle>Stock total</CardTitle>
            <p className="mt-3 text-3xl font-black">{indicadores.totalStock}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Unidades acumuladas en productos activos.</p>
          </Card>
          <Card>
            <CardTitle>Valorización</CardTitle>
            <p className="mt-3 text-3xl font-black">S/ {indicadores.valorInventario.toFixed(2)}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Calculado con costo promedio de entradas.</p>
          </Card>
          <Card>
            <CardTitle>Rotación promedio</CardTitle>
            <p className="mt-3 text-3xl font-black">{indicadores.rotacionPromedio}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Ventas promedio por producto.</p>
          </Card>
          <Card>
            <CardTitle>Productos sin movimiento 30d</CardTitle>
            <p className="mt-3 text-3xl font-black">{indicadores.productosSinMovimiento30d}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Revisar obsolescencia o baja rotación.</p>
          </Card>
        </div>
      ) : null}

      {activeTab === "resumen" ? (
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Productos más vendidos</CardTitle>
          <CardDescription className="mt-1">Clic en un producto para abrir su edición en la pestaña Productos.</CardDescription>
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Producto</TH>
                  <TH className="text-right">Cant. vendida</TH>
                </TRow>
              </THead>
              <tbody>
                {rankingMasVendidos.slice(0, 8).map((row) => (
                  <TRow key={`top-${row.id}`}>
                    <TD>
                      <ProductoIrAEdicion nombre={row.nombre} productoId={row.id} onGo={goToProductoEditor} />
                    </TD>
                    <TD className="text-right font-semibold">{row.vendido}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardTitle>Productos menos vendidos</CardTitle>
          <CardDescription className="mt-1">Clic en un producto para editarlo sin salir de Inventario.</CardDescription>
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Producto</TH>
                  <TH className="text-right">Cant. vendida</TH>
                </TRow>
              </THead>
              <tbody>
                {rankingMenosVendidos.slice(0, 8).map((row) => (
                  <TRow key={`low-${row.id}`}>
                    <TD>
                      <ProductoIrAEdicion nombre={row.nombre} productoId={row.id} onGo={goToProductoEditor} />
                    </TD>
                    <TD className="text-right font-semibold">{row.vendido}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
        <Card>
          <CardTitle>Más ajustados</CardTitle>
          <CardDescription className="mt-1">Clic en el producto para revisar o corregir datos en Productos.</CardDescription>
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Producto</TH>
                  <TH className="text-right">Ajustes</TH>
                </TRow>
              </THead>
              <tbody>
                {topAjustes.slice(0, 8).map((row) => (
                  <TRow key={`adj-${row.id}`}>
                    <TD>
                      <ProductoIrAEdicion nombre={row.nombre} productoId={row.id} onGo={goToProductoEditor} />
                    </TD>
                    <TD className="text-right font-semibold">{row.ajustes}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
      ) : null}

      {activeTab === "productos" ? (
      <Card id="stock-productos">
        <CardTitle>Productos y mantenimiento</CardTitle>
        <CardDescription>Edita catálogo, estado activo y stock mínimo.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Buscar" value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Código, nombre..." />
          <SelectField label="Categoría" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
            <option value="todas">Todas</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </SelectField>
          <SelectField
            label="Estado"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)}
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="stock_bajo">Stock bajo</option>
          </SelectField>
          <div className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            {productosFiltrados.length} productos encontrados
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {productosFiltrados.map((row) => (
            <div
              key={row.id}
              id={`producto-${row.id}`}
              className={cn(
                "rounded-xl border border-[var(--color-border)] p-3",
                highlightedId === row.id && "bg-[var(--color-highlight-bg)] ring-2 ring-[var(--color-highlight-ring)]",
              )}
            >
              <form
                action={updateInventarioProducto}
                className="grid gap-2 md:grid-cols-7"
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      "¿Guardar los cambios de este producto? Revisá código, nombre, categoría y stock mínimo antes de continuar.",
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={row.id} />
                <Field name="codigo" label="Código" defaultValue={row.codigo} required />
                <Field name="nombre" label="Nombre" defaultValue={row.nombre} required />
                <Field name="categoria" label="Categoría" defaultValue={row.categoria} required />
                <Field name="unidad" label="Unidad" defaultValue={row.unidad} required />
                <Field name="stock_minimo" label="Stock mínimo" type="number" min="0" step="0.01" defaultValue={String(row.stock_minimo)} required />
                <div className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs">
                  <p className="font-semibold">Stock: {row.stock_actual}</p>
                  <p className="text-[var(--color-text-secondary)]">Valor: S/ {row.valor_stock.toFixed(2)}</p>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="secondary" disabled={!canMutate}>Guardar</Button>
                </div>
              </form>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form
                  action={toggleInventarioProductoActivo}
                  onSubmit={(e) => {
                    if (
                      !window.confirm(
                        "¿Cambiar el estado activo o inactivo de este producto en el catálogo?",
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="activo" value={row.activo ? "false" : "true"} />
                  <Button type="submit" variant="danger" disabled={!canMutate}>
                    {row.activo ? "Desactivar" : "Activar"}
                  </Button>
                </form>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Estado: {row.activo ? "Activo" : "Inactivo"} · Último mov.:{" "}
                  {row.ultimo_movimiento ? formatDate(row.ultimo_movimiento) : "Sin movimientos"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      {activeTab === "kardex" ? (
      <Card>
        <CardTitle>Kardex y trazabilidad</CardTitle>
        <CardDescription>Filtra y audita entradas, salidas y ajustes por producto.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <SelectField label="Tipo" value={kardexTipo} onChange={(e) => setKardexTipo(e.target.value as typeof kardexTipo)}>
            <option value="todos">Todos</option>
            <option value="entrada_compra">Entrada compra</option>
            <option value="salida_venta">Salida venta</option>
            <option value="ajuste">Ajuste</option>
          </SelectField>
          <SelectField label="Producto" value={kardexProducto} onChange={(e) => setKardexProducto(e.target.value)}>
            <option value="todos">Todos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </SelectField>
          <a href="/inventario/export?type=kardex" className="md:col-span-2 flex items-end">
            <Button type="button" variant="secondary">Exportar kardex CSV</Button>
          </a>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Producto</TH>
                <TH>Tipo</TH>
                <TH className="text-right">Cantidad</TH>
                <TH className="text-right">Impacto</TH>
                <TH>Referencia</TH>
                {canMutate ? <TH>Acción</TH> : null}
              </TRow>
            </THead>
            <tbody>
              {kardexFiltrado.slice(0, 200).map((row) => (
                <TRow key={row.id}>
                  <TD>{formatDate(row.fecha)}</TD>
                  <TD>
                    <ProductoIrAEdicion
                      nombre={row.producto_nombre}
                      productoId={row.producto_id}
                      onGo={goToProductoEditor}
                    />
                  </TD>
                  <TD>{row.tipo}</TD>
                  <TD className="text-right">{row.cantidad}</TD>
                  <TD className={cn("text-right font-semibold", row.impacto >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {row.impacto >= 0 ? `+${row.impacto}` : row.impacto}
                  </TD>
                  <TD>{row.referencia ?? "—"}</TD>
                  {canMutate ? (
                    <TD>
                      <form
                        action={deleteInventarioMovimiento}
                        onSubmit={(event) => {
                          if (
                            !window.confirm(
                              "Primera confirmación: vas a eliminar un movimiento del kardex. Esto altera el historial y puede dejar inconsistencias si no coordinás con contabilidad.\n\n¿Seguís adelante?",
                            )
                          ) {
                            event.preventDefault();
                            return;
                          }
                          const typed = window.prompt(
                            "Confirmación estricta: escribí ELIMINAR en mayúsculas para borrar este movimiento de forma definitiva.",
                            "",
                          );
                          if (typed !== "ELIMINAR") {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="danger">Eliminar</Button>
                      </form>
                    </TD>
                  ) : null}
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      ) : null}

      {activeTab === "alertas" ? (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card id="alertas-stock">
          <CardTitle>Alertas de stock bajo</CardTitle>
          <CardDescription>Toca una alerta para ir al producto.</CardDescription>
          {stockBajo.length > 0 ? (
            <div className="mt-4 space-y-2">
              {stockBajo.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    goToProductoEditor(item.id);
                  }}
                  className="w-full rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-4 py-3 text-left text-sm text-[var(--color-warning-strong)] transition hover:brightness-95"
                >
                  <span className="font-semibold">{item.nombre}</span> ({item.stock_actual}/{item.stock_minimo})
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              Todo bien por ahora. No hay productos en riesgo de agotarse.
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>Sin movimiento (+30 días)</CardTitle>
          <CardDescription>Clic en un producto para abrir su ficha en la pestaña Productos.</CardDescription>
          <div className="mt-4 space-y-2">
            {sinMovimiento.slice(0, 20).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goToProductoEditor(p.id)}
                className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-left text-sm transition hover:bg-[var(--color-primary-soft)]"
              >
                <strong className="text-[var(--color-text-primary)]">{p.nombre}</strong>
                <span className="text-[var(--color-text-secondary)]"> · {p.dias_sin_movimiento} días sin movimiento</span>
              </button>
            ))}
            {sinMovimiento.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">Sin alertas de inactividad.</p> : null}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardTitle>Conteo físico y ajuste automático</CardTitle>
          <CardDescription>Registra stock contado; el sistema crea ajuste con trazabilidad.</CardDescription>
          <form
            action={registrarConteoInventario}
            className="mt-4 grid gap-3 md:grid-cols-4"
            onSubmit={(e) => {
              if (
                !window.confirm(
                  "¿Aplicar el conteo físico? Se generará un ajuste en el kardex con la diferencia respecto al stock del sistema.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <SelectField name="producto_id" label="Producto" defaultValue="" required>
              <option value="" disabled>Seleccionar</option>
              {productos.filter((p) => p.activo !== false).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} - {p.nombre}
                </option>
              ))}
            </SelectField>
            <Field name="fecha" type="date" label="Fecha" required />
            <Field name="stock_contado" type="number" step="0.01" min="0" label="Stock contado" required />
            <Field name="referencia" label="Motivo / referencia" placeholder="Conteo físico almacén mayo" required />
            <div className="md:col-span-4">
              <Button type="submit" disabled={!canMutate}>Aplicar conteo</Button>
            </div>
          </form>
        </Card>
      </div>
      ) : null}

      {activeTab === "reportes" ? (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Exportaciones</CardTitle>
          <CardDescription>Descarga reportes para análisis externo.</CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/inventario/export?type=stock"><Button type="button" variant="secondary">Exportar stock valorizado CSV</Button></a>
            <a href="/inventario/export?type=kardex"><Button type="button" variant="secondary">Exportar kardex CSV</Button></a>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Útil para auditoría, compras y control gerencial.
          </p>
        </Card>
        <Card>
          <CardTitle>Reposición sugerida</CardTitle>
          <CardDescription>Basado en stock mínimo y stock actual. Clic en el producto para editarlo.</CardDescription>
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <Table>
              <THead>
                <TRow>
                  <TH>Producto</TH>
                  <TH className="text-right">Actual</TH>
                  <TH className="text-right">Mínimo</TH>
                  <TH className="text-right">Sugerido</TH>
                </TRow>
              </THead>
              <tbody>
                {reposicionSugerida.slice(0, 20).map((row) => (
                  <TRow key={row.id}>
                    <TD>
                      <ProductoIrAEdicion nombre={row.nombre} productoId={row.id} onGo={goToProductoEditor} />
                    </TD>
                    <TD className="text-right">{row.stock_actual}</TD>
                    <TD className="text-right">{row.stock_minimo}</TD>
                    <TD className="text-right font-semibold">{row.sugerido_reponer}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
      ) : null}

      {!canMutate ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Tu rol está en solo lectura para operaciones de inventario. Puedes consultar métricas y reportes.
        </p>
      ) : null}
    </>
  );
}
