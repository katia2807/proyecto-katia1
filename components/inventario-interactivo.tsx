"use client";

import {
  deleteInventarioMovimiento,
  deleteInventarioProducto,
  inventarioProductoTieneMovimientosEnKardex,
  registrarConteoInventario,
  toggleInventarioProductoActivo,
} from "@/app/actions";
import { InventarioProductoEditModal } from "@/components/inventario/inventario-producto-edit-modal";
import { InventarioTomaDecisionesCharts } from "@/components/inventario/inventario-toma-decisiones-charts";
import { MueblesCatalogoSection } from "@/components/inventario/muebles-catalogo-section";
import {
  buildParetoInventarioRows,
  type ParetoInventarioMode,
} from "@/lib/inventario-pareto";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconPhoto } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PhraseConfirmDialog } from "@/components/ui/phrase-confirm-dialog";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { Field, SelectField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

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
  foto_url: string | null;
  costo_unitario: number | null;
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
    movimientosDelMes?: number;
    totalStock: number;
    valorInventario: number;
    rotacionPromedio: number;
    productosConStockBajo: number;
    productosSinMovimiento30d: number;
  };
};

type MuebleCatalogoInventarioRow = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_lista: number | string;
  foto_url: string | null;
  activo: boolean;
};

type InventarioInteractiveTab =
  | "resumen"
  | "productos"
  | "decisiones"
  | "kardex"
  | "alertas"
  | "reportes";

type Props = {
  data: InventarioData;
  canMutate: boolean;
  mueblesCatalogo: MuebleCatalogoInventarioRow[];
};

/** Filas iniciales en pestaña Productos; “Mostrar más” amplía sin recargar. */
const PRODUCTOS_LIST_PAGE = 20;

const INVENTARIO_TAB_ORDER: InventarioInteractiveTab[] = [
  "resumen",
  "productos",
  "decisiones",
  "kardex",
  "alertas",
  "reportes",
];

function inventarioTabFromSearchParam(tab: string | null): InventarioInteractiveTab {
  const raw = (tab ?? "").trim().toLowerCase();
  if (!raw) return "resumen";
  if (raw === "prioridad") return "decisiones";
  return INVENTARIO_TAB_ORDER.includes(raw as InventarioInteractiveTab)
    ? (raw as InventarioInteractiveTab)
    : "resumen";
}

function isInventarioProductoKardexBlockError(e: unknown): boolean {
  const msg = typeof e === "string" ? e : e instanceof Error ? e.message : "";
  return (
    msg.includes("[INV_KARDEX_BLOCK]") ||
    /movimiento.*kardex|kardex.*movimiento/i.test(msg) ||
    /tiene al menos un movimiento/i.test(msg) ||
    /tiene movimientos en el kardex/i.test(msg)
  );
}

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
      title="Ir a la pestaña Productos y abrir el editor en panel lateral"
      className="-m-1 max-w-full rounded-md px-1 py-0.5 text-left text-[var(--color-text-primary)] underline-offset-2 hover:bg-[var(--color-primary-soft)] hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      onClick={() => onGo(productoId)}
    >
      <span className="font-medium">{nombre}</span>
    </button>
  );
}

export function InventarioInteractivo({ data, canMutate, mueblesCatalogo }: Props) {
  const {
    productos,
    movimientos,
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = useMemo(
    () => inventarioTabFromSearchParam(searchParams.get("tab")),
    [searchParams],
  );
  const { showToast } = useToast();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [viewPerspective, setViewPerspective] = useState<"texto" | "galeria">("texto");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activos" | "inactivos" | "stock_bajo">("todos");
  const [filterStockMin, setFilterStockMin] = useState("");
  const [filterStockMax, setFilterStockMax] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [productosListLimit, setProductosListLimit] = useState(PRODUCTOS_LIST_PAGE);
  const [kardexTipo, setKardexTipo] = useState<"todos" | "entrada_compra" | "salida_venta" | "ajuste">("todos");
  const [kardexProducto, setKardexProducto] = useState("todos");
  const [paretoMode, setParetoMode] = useState<ParetoInventarioMode>("unidades");
  const [editModalProductId, setEditModalProductId] = useState<string | null>(null);
  const [editSession, setEditSession] = useState(0);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; nextActivo: boolean; nombre: string } | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<{ id: string; nombre: string } | null>(null);
  const [deleteProductStep1Open, setDeleteProductStep1Open] = useState(false);
  const [deleteProductPhraseOpen, setDeleteProductPhraseOpen] = useState(false);
  const [deleteProductCascadeOpen, setDeleteProductCascadeOpen] = useState(false);
  const deleteProductOpeningCascadeRef = useRef(false);
  const [kardexDeleteMovId, setKardexDeleteMovId] = useState<string | null>(null);
  const [kardexDeleteStep1Open, setKardexDeleteStep1Open] = useState(false);
  const [kardexDeletePhraseOpen, setKardexDeletePhraseOpen] = useState(false);
  /** Seteado al detectar #producto-uuid (el hash se limpia después; la ref conserva el id para ampliar la lista). */
  const deepLinkProductoIdRef = useRef<string | null>(null);
  const deepLinkScrollHechoRef = useRef(false);

  const getFotoUrlEfectiva = useCallback((row: ProductoEnriched) => {
    if (row.foto_url) return row.foto_url;
    if (!mueblesCatalogo) return null;
    const match = mueblesCatalogo.find(
      (m) =>
        m.nombre.trim().toLowerCase() === row.nombre.trim().toLowerCase() ||
        m.codigo.trim().toLowerCase() === row.codigo.trim().toLowerCase()
    );
    return match?.foto_url || null;
  }, [mueblesCatalogo]);

  const irATab = useCallback(
    (tab: InventarioInteractiveTab) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (tab === "resumen") qs.delete("tab");
      else qs.set("tab", tab);
      const q = qs.toString();
      const base = pathname || "/inventario";
      router.replace(q ? `${base}?${q}` : base, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const editingProduct = useMemo(
    () => (editModalProductId ? productos.find((p) => p.id === editModalProductId) ?? null : null),
    [editModalProductId, productos],
  );

  const goToProductoEditor = useCallback(
    (productoId: string) => {
      setEditSession((s) => s + 1);
      irATab("productos");
      setEditModalProductId(productoId);
    },
    [irATab],
  );

  const openCompraReponer = useCallback((productoId: string) => {
    router.push(`/inventario?quick=compra&producto_id=${encodeURIComponent(productoId)}`);
  }, [router]);

  const openProductoModal = useCallback(
    (productoId: string) => {
      setEditSession((s) => s + 1);
      irATab("productos");
      setEditModalProductId(productoId);
    },
    [irATab],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.location.hash?.replace(/^#/, "") ?? "";
    const m = /^producto-(.+)$/.exec(raw);
    if (!m?.[1]) return;
    const productoId = m[1];
    deepLinkProductoIdRef.current = productoId;
    irATab("productos");
    const pathOnly = `${window.location.pathname}${window.location.search}`;
    try {
      window.history.replaceState(null, "", pathOnly);
    } catch {
      /* ignore */
    }
  }, [irATab]);

  useEffect(() => {
    if (!deleteProductTarget) {
      setDeleteProductStep1Open(false);
      setDeleteProductPhraseOpen(false);
      setDeleteProductCascadeOpen(false);
    }
  }, [deleteProductTarget]);

  useEffect(() => {
    if (!kardexDeleteMovId) {
      setKardexDeleteStep1Open(false);
      setKardexDeletePhraseOpen(false);
    }
  }, [kardexDeleteMovId]);

  const productosFiltrados = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return productos.filter((p) => {
      if (filterCategoria !== "todas" && p.categoria !== filterCategoria) return false;
      if (filterEstado === "activos" && p.activo === false) return false;
      if (filterEstado === "inactivos" && p.activo !== false) return false;
      if (filterEstado === "stock_bajo" && Number(p.stock_actual) > Number(p.stock_minimo)) return false;
      if (filterStockMin !== "" && Number(p.stock_actual) < Number(filterStockMin)) return false;
      if (filterStockMax !== "" && Number(p.stock_actual) > Number(filterStockMax)) return false;
      if (!q) return true;
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      );
    });
  }, [filterCategoria, filterEstado, filterStockMax, filterStockMin, filterText, productos]);

  useEffect(() => {
    setProductosListLimit(PRODUCTOS_LIST_PAGE);
  }, [filterCategoria, filterEstado, filterStockMax, filterStockMin, filterText]);

  const selectedProduct = useMemo(
    () => (selectedProductId ? productos.find((p) => p.id === selectedProductId) ?? null : null),
    [productos, selectedProductId],
  );
  const selectedProductKardex = useMemo(
    () => (selectedProduct ? kardex.filter((row) => row.producto_id === selectedProduct.id).slice(0, 10) : []),
    [kardex, selectedProduct],
  );
  const selectedProductPriceHistory = useMemo(
    () =>
      selectedProduct
        ? movimientos
            .filter((row) => row.producto_id === selectedProduct.id && row.tipo === "entrada_compra" && row.costo_unitario)
            .slice(0, 5)
        : [],
    [movimientos, selectedProduct],
  );

  const productosFiltradosVisibles = useMemo(
    () => productosFiltrados.slice(0, productosListLimit),
    [productosFiltrados, productosListLimit],
  );

  /** Ancla #producto-uuid: ampliar lista si hace falta y centrar fila tras pintar (una vez). */
  useEffect(() => {
    const productoId = deepLinkProductoIdRef.current;
    if (!productoId) return;
    const idx = productosFiltrados.findIndex((p) => p.id === productoId);
    if (idx < 0) return;
    setProductosListLimit((prev) => Math.max(prev, idx + 1));
    if (deepLinkScrollHechoRef.current) return;
    const id = productoId;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const row = document.getElementById(`producto-${id}`);
        if (!row) return;
        deepLinkScrollHechoRef.current = true;
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setHighlightedId(id);
        window.setTimeout(() => setHighlightedId(null), 3200);
      });
    });
  }, [productosFiltrados]);

  const kardexFiltrado = useMemo(() => {
    return kardex.filter((k) => {
      if (kardexTipo !== "todos" && k.tipo !== kardexTipo) return false;
      if (kardexProducto !== "todos" && k.producto_id !== kardexProducto) return false;
      return true;
    });
  }, [kardex, kardexProducto, kardexTipo]);

  const paretoInventario = useMemo(
    () => buildParetoInventarioRows(productos, paretoMode),
    [productos, paretoMode],
  );

  const paretoConteoClase = useMemo(() => {
    return paretoInventario.rows.reduce(
      (acc, r) => {
        acc[r.clase] += 1;
        return acc;
      },
      { A: 0, B: 0, C: 0 },
    );
  }, [paretoInventario.rows]);

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
        <CardDescription>
          <strong>Productos</strong>: stock, catálogo e insumos.{" "}
          <strong>Kardex</strong>: movimientos trazables.{" "}
          <strong>Alertas</strong>: stock bajo y reposición.{" "}
          El análisis de decisiones (Pareto ABC) está en el <a href="/gerencial" className="underline text-[var(--katia-primary)]">Centro de Mando</a>.
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={tabBtnClass("resumen")} onClick={() => irATab("resumen")}>Resumen</button>
          <button type="button" className={tabBtnClass("productos")} onClick={() => irATab("productos")}>Productos</button>
          <button type="button" className={tabBtnClass("kardex")} onClick={() => irATab("kardex")}>Kardex</button>
          <button type="button" className={tabBtnClass("alertas")} onClick={() => irATab("alertas")}>Alertas</button>
          <button type="button" className={tabBtnClass("reportes")} onClick={() => irATab("reportes")}>Reportes</button>
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
            <CardTitle>Valor del inventario</CardTitle>
            <p className="mt-3 text-3xl font-black">S/ {(() => {
              const totalInventario = productos
                .filter(p => p.activo !== false)
                .reduce((sum, p) => sum + Number(p.valor_stock ?? 0), 0);
              return totalInventario.toFixed(2);
            })()}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Suma de stock × costo unitario de cada producto activo.</p>
          </Card>
          <Card>
            <CardTitle>Ganancias del mes (ventas)</CardTitle>
            <p className="mt-3 text-3xl font-black">S/ {(() => {
              const hoy = new Date();
              const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
              const gananciasMes = movimientos
                .filter(m => m.tipo === 'salida_venta' && m.fecha.startsWith(mesActual))
                .reduce((sum, m) => sum + (Number(m.cantidad) * Number(m.costo_unitario ?? 0)), 0);
              return gananciasMes.toFixed(2);
            })()}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Total vendido este mes: cantidad × costo unitario por cada venta.</p>
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

      {activeTab === "resumen" && stockBajo.length > 0 ? (
        <Card>
          <CardTitle>Alertas activas</CardTitle>
          <CardDescription className="mt-1">
            Productos con stock por debajo del mínimo. Usá Reponer para abrir el registro de compra con el producto ya
            elegido.
          </CardDescription>
          <ul className="mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {stockBajo.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--color-text-primary)]"
              >
                <div className="min-w-0">
                  <span className="font-semibold">{item.nombre}</span>
                  <span className="block text-xs text-[var(--color-text-secondary)]">
                    Stock {item.stock_actual} / mín. {item.stock_minimo}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 border border-[var(--color-op-success-border)] bg-[var(--color-op-success-bg)] text-[var(--color-op-success-text)] hover:bg-[var(--color-op-success-hover)]"
                  disabled={!canMutate}
                  onClick={() => openCompraReponer(item.id)}
                >
                  Reponer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
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
        <CardDescription>
          Editá cada producto desde el panel lateral (botón Editar). Desactivar y eliminar piden confirmación; eliminar
          exige escribir ELIMINAR.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <div className="grid gap-3 md:grid-cols-5 flex-1 min-w-[280px]">
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
            <Field label="Stock min." type="number" value={filterStockMin} onChange={(e) => setFilterStockMin(e.target.value)} placeholder="0" />
            <Field label="Stock max." type="number" value={filterStockMax} onChange={(e) => setFilterStockMax(e.target.value)} placeholder="999" />
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              {productosFiltrados.length === 0
                ? "0 productos"
                : productosListLimit >= productosFiltrados.length
                  ? `${productosFiltrados.length} productos`
                  : `Mostrando ${productosFiltradosVisibles.length} de ${productosFiltrados.length}`}
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] opacity-70">Perspectiva</span>
              <div className="inline-flex rounded-xl bg-[var(--color-primary-soft)] p-0.5 border border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setViewPerspective("texto")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    viewPerspective === "texto"
                      ? "bg-[var(--color-accent)] text-white shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  Puro texto
                </button>
                <button
                  type="button"
                  onClick={() => setViewPerspective("galeria")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    viewPerspective === "galeria"
                      ? "bg-[var(--color-accent)] text-white shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  Imagen y nombre
                </button>
              </div>
            </div>
          </div>
        </div>
        {selectedBatchIds.size > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-3">
            <span className="text-sm font-semibold">{selectedBatchIds.size} seleccionados</span>
            <Button type="button" variant="secondary" disabled={!canMutate}>Desactivar</Button>
            <Button type="button" variant="secondary">Exportar</Button>
            <Button type="button" variant="secondary" disabled={!canMutate}>Ajustar stock</Button>
          </div>
        ) : null}
        {viewPerspective === "galeria" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {productosFiltradosVisibles.map((row) => {
              const fotoUrlEfectiva = getFotoUrlEfectiva(row);
              const esImagen = fotoUrlEfectiva && /\.(png|jpe?g|webp|gif)$/i.test(fotoUrlEfectiva);
              return (
                <div
                  key={row.id}
                  id={`producto-${row.id}`}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] hover:border-[var(--color-border-strong)] transition-all flex flex-col cursor-pointer",
                    highlightedId === row.id && "bg-[var(--color-highlight-bg)] ring-2 ring-[var(--color-highlight-ring)]",
                  )}
                  onClick={() => setSelectedProductId(row.id)}
                >
                  {/* Checkbox multi-select floating */}
                  <div className="absolute left-2 top-2 z-10">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${row.nombre}`}
                      checked={selectedBatchIds.has(row.id)}
                      onChange={(event) => {
                        event.stopPropagation();
                        setSelectedBatchIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        });
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="size-4 rounded cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                    />
                  </div>

                  {/* Imagen del producto */}
                  <div className="relative aspect-[4/3] w-full bg-[var(--color-primary-soft)] overflow-hidden flex items-center justify-center border-b border-[var(--color-border)]">
                    {esImagen ? (
                      <img
                        src={fotoUrlEfectiva!}
                        alt={row.nombre}
                        className="object-cover w-full h-full transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-[var(--color-text-secondary)] opacity-40">
                        <IconPhoto className="size-8" aria-hidden />
                        <span className="text-[10px]">Sin imagen</span>
                      </div>
                    )}

                    {/* Stock badge */}
                    <div className="absolute right-2 bottom-2 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white">
                      Stock: {row.stock_actual}
                    </div>

                    {/* Categoría badge */}
                    <div className="absolute right-2 top-2 rounded-lg bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {row.categoria}
                    </div>
                  </div>

                  {/* Detalle simple: Nombre del producto */}
                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
                      {row.nombre}
                    </p>

                    {/* Botones de acción minimalistas */}
                    <div className="flex justify-end gap-1.5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-medium"
                        onClick={(event) => {
                          event.stopPropagation();
                          openProductoModal(row.id);
                        }}
                        disabled={!canMutate}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant={row.activo ? "danger" : "secondary"}
                        size="sm"
                        className="h-7 px-2 text-[10px] font-medium"
                        onClick={(event) => {
                          event.stopPropagation();
                          setToggleTarget({
                            id: row.id,
                            nextActivo: !row.activo,
                            nombre: row.nombre,
                          });
                        }}
                        disabled={!canMutate}
                      >
                        {row.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="h-7 px-2 text-[10px] font-medium"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteProductTarget({ id: row.id, nombre: row.nombre });
                          setDeleteProductStep1Open(true);
                        }}
                        disabled={!canMutate}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {productosFiltradosVisibles.map((row) => (
              <div
                key={row.id}
                id={`producto-${row.id}`}
                className={cn(
                  "cursor-pointer rounded-xl border border-[var(--color-border)] p-4",
                  highlightedId === row.id && "bg-[var(--color-highlight-bg)] ring-2 ring-[var(--color-highlight-ring)]",
                )}
                onClick={() => setSelectedProductId(row.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${row.nombre}`}
                    checked={selectedBatchIds.has(row.id)}
                    onChange={(event) => {
                      event.stopPropagation();
                      setSelectedBatchIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      });
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-1 size-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{row.nombre}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {row.codigo} · {row.categoria} · {row.unidad} · Mín. {row.stock_minimo} · Costo unit. promedio: S/ {Number(row.costo_unitario_promedio ?? 0).toFixed(2)} · Stock {row.stock_actual} · Valor: S/ {Number(row.valor_stock ?? 0).toFixed(2)}
                      {Number(row.costo_unitario_promedio ?? 0) === 0 && Number(row.stock_actual) > 0 ? (
                        <span className="ml-1 text-[var(--color-text-secondary)] opacity-70">(sin costo registrado)</span>
                      ) : null}
                    </p>
                    {getFotoUrlEfectiva(row) && (
                      <p className="mt-1 text-xs text-[var(--color-accent)] font-semibold flex items-center gap-1">
                        <IconPhoto className="size-3.5" /> Tiene foto referencial
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      Estado: {row.activo ? "Activo" : "Inactivo"} · Último mov.:{" "}
                      {row.ultimo_movimiento ? formatDate(row.ultimo_movimiento) : "Sin movimientos"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={(event) => { event.stopPropagation(); openProductoModal(row.id); }} disabled={!canMutate}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant={row.activo ? "danger" : "secondary"}
                      onClick={(event) => {
                        event.stopPropagation();
                        setToggleTarget({
                          id: row.id,
                          nextActivo: !row.activo,
                          nombre: row.nombre,
                        })
                      }}
                      disabled={!canMutate}
                    >
                      {row.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteProductTarget({ id: row.id, nombre: row.nombre });
                        setDeleteProductStep1Open(true);
                      }}
                      disabled={!canMutate}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {productosListLimit < productosFiltrados.length ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProductosListLimit((n) => n + PRODUCTOS_LIST_PAGE)}
            >
              Mostrar más ({productosFiltrados.length - productosListLimit} restantes)
            </Button>
          </div>
        ) : null}
      </Card>
      ) : null}

      {activeTab === "productos" ? (
        <div id="catalogo-muebles-inventario" className="space-y-4">
          <MueblesCatalogoSection muebles={mueblesCatalogo} canMutate={canMutate} />
        </div>
      ) : null}

      {activeTab === "decisiones" ? (
        <div id="inventario-toma-decisiones" className="space-y-4">
          <Card>
            <CardTitle>Toma de decisiones · Pareto y ABC</CardTitle>
            <CardDescription className="mt-1 space-y-2">
              <span className="block">
                Usa los mismos totales por producto que el resumen: unidades vendidas sumando movimientos{" "}
                <strong>salida_venta</strong> cargados en esta sesión (misma fuente que rankings y kardex).
              </span>
              <span className="block">
                <strong>Clase A</strong>: hasta cubrir el 80% acumulado del criterio elegido. <strong>B</strong>: del 80%
                al 95%. <strong>C</strong>: el resto (suele alcanzar con stock mínimo o revisar obsolescencia).
              </span>
              <span className="block text-[var(--color-text-secondary)]">
                <strong>Valor a costo (estim.)</strong>: unidades vendidas × costo promedio de entradas. No es utilidad ni
                margen; sirve para ver concentración en soles a costo.
              </span>
            </CardDescription>
            <div className="mt-4 max-w-md">
              <SelectField
                label="Criterio de concentración"
                value={paretoMode}
                onChange={(e) => setParetoMode(e.target.value as ParetoInventarioMode)}
              >
                <option value="unidades">Por unidades vendidas</option>
                <option value="valor_costo">Por valor a costo estimado (S/)</option>
              </SelectField>
            </div>
          </Card>

          {paretoInventario.totalMetric <= 0 ? (
            <Card>
              <CardTitle>Sin datos de venta</CardTitle>
              <CardDescription>
                No hay salidas por venta registradas en los movimientos cargados, o todas las cantidades son cero. Cuando
                haya ventas, acá aparecerán los gráficos y el ranking.
              </CardDescription>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardTitle className="text-sm">Corte 80%</CardTitle>
                  <p className="mt-2 text-2xl font-black text-[var(--color-text-primary)]">
                    {paretoInventario.countHasta80}{" "}
                    <span className="text-base font-semibold text-[var(--color-text-secondary)]">
                      producto{paretoInventario.countHasta80 === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Primeros ítems que alcanzan el 80% acumulado{" "}
                    {paretoMode === "unidades" ? "en unidades vendidas" : "en valor a costo estimado"}.
                  </p>
                </Card>
                <Card>
                  <CardTitle className="text-sm">Productos por clase</CardTitle>
                  <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                    <span className="font-semibold text-emerald-700">A:</span> {paretoConteoClase.A} ·{" "}
                    <span className="font-semibold text-amber-800">B:</span> {paretoConteoClase.B} ·{" "}
                    <span className="font-semibold text-slate-600">C:</span> {paretoConteoClase.C}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Clasificación según % acumulado antes de cada fila (regla típica ABC 80/15/5).
                  </p>
                </Card>
                <Card>
                  <CardTitle className="text-sm">Total referencia</CardTitle>
                  <p className="mt-2 text-2xl font-black text-[var(--color-text-primary)]">
                    {paretoMode === "unidades"
                      ? `${paretoInventario.totalMetric.toLocaleString("es-PE")} u.`
                      : formatPen(paretoInventario.totalMetric)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Suma de todas las filas (productos activos). Cambiá el criterio arriba para ver otra curva.
                  </p>
                </Card>
              </div>

              <InventarioTomaDecisionesCharts
                rows={paretoInventario.rows}
                mode={paretoMode}
                totalMetric={paretoInventario.totalMetric}
              />

              <Card>
                <CardTitle>Tabla · ranking con % acumulado</CardTitle>
                <CardDescription>
                  Clic en el producto para editarlo. Stock bajo respecto al mínimo: podés reponer con el mismo flujo que
                  en alertas.
                </CardDescription>
                <div className="mt-4 max-h-[min(70vh,36rem)] overflow-auto rounded-xl border border-[var(--color-border)]">
                  <Table>
                    <THead>
                      <TRow>
                        <TH className="w-10">#</TH>
                        <TH className="w-14">Clase</TH>
                        <TH>Producto</TH>
                        <TH className="text-right">{paretoMode === "unidades" ? "Vendido" : "Valor est."}</TH>
                        <TH className="text-right">% del total</TH>
                        <TH className="text-right">% acum.</TH>
                        <TH className="text-right">Stock</TH>
                        <TH className="text-right">Mín.</TH>
                        <TH className="text-right">Compra</TH>
                      </TRow>
                    </THead>
                    <tbody>
                      {paretoInventario.rows.map((row, i) => {
                        const p = row.producto;
                        const bajo = Number(p.stock_actual) <= Number(p.stock_minimo);
                        return (
                          <TRow key={p.id}>
                            <TD className="text-[var(--color-text-secondary)]">{i + 1}</TD>
                            <TD>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
                                  row.clase === "A" && "bg-emerald-100 text-emerald-900",
                                  row.clase === "B" && "bg-amber-100 text-amber-900",
                                  row.clase === "C" && "bg-slate-200 text-slate-800",
                                )}
                              >
                                {row.clase}
                              </span>
                            </TD>
                            <TD>
                              <ProductoIrAEdicion nombre={p.nombre} productoId={p.id} onGo={goToProductoEditor} />
                              <span className="block text-xs text-[var(--color-text-secondary)]">{p.codigo}</span>
                            </TD>
                            <TD className="text-right font-semibold">
                              {paretoMode === "unidades"
                                ? row.metric.toLocaleString("es-PE")
                                : formatPen(row.metric)}
                            </TD>
                            <TD className="text-right">{row.pctTotal.toFixed(1)}%</TD>
                            <TD className="text-right font-medium">{row.pctAcum.toFixed(1)}%</TD>
                            <TD className={cn("text-right", bajo && "text-amber-800 font-semibold")}>
                              {p.stock_actual}
                            </TD>
                            <TD className="text-right">{p.stock_minimo}</TD>
                            <TD className="text-right">
                              {bajo && canMutate ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="shrink-0 whitespace-nowrap border border-[var(--color-op-success-border)] bg-[var(--color-op-success-bg)] text-[var(--color-op-success-text)] hover:bg-[var(--color-op-success-hover)]"
                                  onClick={() => openCompraReponer(p.id)}
                                >
                                  Reponer
                                </Button>
                              ) : (
                                "—"
                              )}
                            </TD>
                          </TRow>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </div>
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
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => {
                          setKardexDeleteMovId(row.id);
                          setKardexDeleteStep1Open(true);
                        }}
                      >
                        Eliminar
                      </Button>
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
      <div className="space-y-8">
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
        </div>

        <section className="space-y-3" aria-labelledby="inventario-ajuste-stock-heading">
          <h3
            id="inventario-ajuste-stock-heading"
            className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]"
          >
            Ajuste de stock
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Conteo físico y diferencias respecto al sistema. Separado de las alertas de reposición.
          </p>
          <Card>
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
        </section>
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

      <InventarioProductoEditModal
        key={`${editModalProductId ?? "closed"}-${editSession}`}
        product={editingProduct}
        open={Boolean(editModalProductId)}
        onOpenChange={(next) => {
          if (!next) setEditModalProductId(null);
        }}
        canMutate={canMutate}
        formatDate={formatDate}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(o) => {
          if (!o) setToggleTarget(null);
        }}
        title={toggleTarget?.nextActivo ? "¿Activar producto?" : "¿Desactivar producto?"}
        confirmLabel={toggleTarget?.nextActivo ? "Sí, activar" : "Sí, desactivar"}
        confirmVariant="primary"
        tone="neutral"
        onConfirm={async () => {
          if (!toggleTarget) return;
          const fd = new FormData();
          fd.set("id", toggleTarget.id);
          fd.set("activo", String(toggleTarget.nextActivo));
          await toggleInventarioProductoActivo(fd);
          router.refresh();
          setToggleTarget(null);
          showToast({ variant: "success", message: "Estado del producto actualizado." });
        }}
      >
        <p>
          Producto: <strong>{toggleTarget?.nombre}</strong>
        </p>
        <p className="text-xs">
          {toggleTarget?.nextActivo
            ? "Volverá a mostrarse en listas y combos donde aplique."
            : "Dejará de mostrarse en listas activas; el historial de movimientos se conserva."}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteProductStep1Open && Boolean(deleteProductTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteProductStep1Open(false);
            setDeleteProductTarget(null);
          }
        }}
        title="¿Eliminar este producto?"
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          setDeleteProductStep1Open(false);
          setDeleteProductPhraseOpen(true);
          // Evitar que ConfirmDialog llame onOpenChange(false): borraría deleteProductTarget y el paso "ELIMINAR" nunca abriría.
          return false;
        }}
      >
        <p>
          Vas a eliminar <strong>{deleteProductTarget?.nombre}</strong> del catálogo. El siguiente paso pedirá escribir
          ELIMINAR. Si hay movimientos en el kardex, podrás elegir eliminar también todo ese historial.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">El siguiente paso pedirá escribir ELIMINAR.</p>
      </ConfirmDialog>

      <PhraseConfirmDialog
        open={deleteProductPhraseOpen && Boolean(deleteProductTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteProductPhraseOpen(false);
            if (deleteProductOpeningCascadeRef.current) {
              deleteProductOpeningCascadeRef.current = false;
            } else {
              setDeleteProductTarget(null);
            }
          }
        }}
        title="Confirmación estricta"
        expectedPhrase="ELIMINAR"
        confirmLabel="Eliminar definitivamente"
        onConfirm={async () => {
          if (!deleteProductTarget) return;
          const id = deleteProductTarget.id;
          let tieneMovsEnServidor = false;
          try {
            tieneMovsEnServidor = await inventarioProductoTieneMovimientosEnKardex(id);
          } catch {
            tieneMovsEnServidor = movimientos.some((m) => m.producto_id === id);
          }
          if (tieneMovsEnServidor) {
            deleteProductOpeningCascadeRef.current = true;
            setDeleteProductCascadeOpen(true);
            return;
          }
          const fd = new FormData();
          fd.set("id", id);
          try {
            await deleteInventarioProducto(fd);
          } catch (e) {
            if (isInventarioProductoKardexBlockError(e)) {
              deleteProductOpeningCascadeRef.current = true;
              setDeleteProductCascadeOpen(true);
              return;
            }
            const message =
              typeof e === "string" && e.trim()
                ? e
                : e instanceof Error && e.message
                  ? e.message
                  : "No se pudo eliminar el producto.";
            showToast({ variant: "error", message });
            return false;
          }
          setEditModalProductId((prev) => (prev === id ? null : prev));
          setDeleteProductTarget(null);
          showToast({ variant: "success", message: "Producto eliminado del catálogo." });
          router.refresh();
        }}
      >
        <p>
          Eliminación definitiva de <strong>{deleteProductTarget?.nombre}</strong>. Esta acción no se puede deshacer.
        </p>
      </PhraseConfirmDialog>

      <ConfirmDialog
        open={deleteProductCascadeOpen && Boolean(deleteProductTarget)}
        stackAbovePhraseConfirm
        onOpenChange={(o) => {
          if (!o) {
            setDeleteProductCascadeOpen(false);
            setDeleteProductTarget(null);
          }
        }}
        title="Producto con movimientos en el kardex"
        confirmLabel="Sí, eliminar todo"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!deleteProductTarget) return false;
          const fd = new FormData();
          fd.set("id", deleteProductTarget.id);
          fd.set("forzarConMovimientos", "true");
          try {
            await deleteInventarioProducto(fd);
          } catch (e) {
            const message =
              typeof e === "string" && e.trim()
                ? e
                : e instanceof Error && e.message
                  ? e.message
                  : "No se pudo eliminar el producto ni sus movimientos.";
            showToast({ variant: "error", message });
            return false;
          }
          const deletedId = deleteProductTarget.id;
          setEditModalProductId((prev) => (prev === deletedId ? null : prev));
          setDeleteProductCascadeOpen(false);
          setDeleteProductTarget(null);
          showToast({
            variant: "success",
            message: "Producto y sus movimientos eliminados correctamente.",
          });
          router.refresh();
        }}
      >
        <p>
          Este producto tiene movimientos en el kardex. ¿Deseas eliminar también todos sus movimientos?
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Se borrarán primero todas las filas del kardex vinculadas a <strong>{deleteProductTarget?.nombre}</strong> y
          después el producto. Esta acción no se puede deshacer.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={kardexDeleteStep1Open && Boolean(kardexDeleteMovId)}
        onOpenChange={(o) => {
          if (!o) {
            setKardexDeleteStep1Open(false);
            setKardexDeleteMovId(null);
          }
        }}
        title="¿Eliminar movimiento del kardex?"
        confirmLabel="Continuar"
        onConfirm={async () => {
          setKardexDeleteStep1Open(false);
          setKardexDeletePhraseOpen(true);
          return false;
        }}
      >
        <p>
          Se borrará el registro y se recalculará el stock del producto. Coordiná con contabilidad si hay dudas.
        </p>
        <p className="text-xs">El siguiente paso pedirá escribir ELIMINAR.</p>
      </ConfirmDialog>

      <PhraseConfirmDialog
        open={kardexDeletePhraseOpen && Boolean(kardexDeleteMovId)}
        onOpenChange={(o) => {
          if (!o) setKardexDeleteMovId(null);
        }}
        title="Eliminar movimiento"
        expectedPhrase="ELIMINAR"
        confirmLabel="Eliminar movimiento"
        onConfirm={async () => {
          if (!kardexDeleteMovId) return;
          const fd = new FormData();
          fd.set("id", kardexDeleteMovId);
          await deleteInventarioMovimiento(fd);
          setKardexDeleteMovId(null);
          showToast({ variant: "success", message: "Movimiento eliminado del kardex." });
          router.refresh();
        }}
      >
        <p>Confirmá la baja del movimiento seleccionado. El stock se actualizará en consecuencia.</p>
      </PhraseConfirmDialog>

      <DetailDrawer
        open={Boolean(selectedProduct)}
        title={selectedProduct?.nombre ?? "Producto"}
        description="Stock, valorizacion, precios de compra y ultimos movimientos"
        onClose={() => setSelectedProductId(null)}
        onEdit={() => selectedProduct && openProductoModal(selectedProduct.id)}
      >
        {selectedProduct ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <DetailField label="Stock actual" value={`${selectedProduct.stock_actual} ${selectedProduct.unidad}`} />
              <DetailField label="Stock minimo" value={`${selectedProduct.stock_minimo} ${selectedProduct.unidad}`} />
              <DetailField
                label="Valorización"
                value={
                  Number(selectedProduct.costo_unitario_promedio ?? 0) === 0
                    ? `S/ 0.00 — sin compras con costo`
                    : formatPen(selectedProduct.valor_stock ?? 0)
                }
              />
              {Number(selectedProduct.costo_unitario_promedio ?? 0) === 0 && (
                <p className="text-xs text-[var(--color-text-secondary)] italic">
                  Registrá una compra con costo unitario para calcular la valorización correctamente.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => openCompraReponer(selectedProduct.id)} disabled={!canMutate}>
                Registrar compra
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push(`/inventario?quick=movimiento&producto_id=${selectedProduct.id}`)} disabled={!canMutate}>
                Registrar movimiento
              </Button>
            </div>
            <section>
              <h3 className="text-sm font-semibold">Historial de precios de compra</h3>
              <div className="mt-2 space-y-2">
                {selectedProductPriceHistory.length > 0 ? (
                  selectedProductPriceHistory.map((row) => (
                    <div key={row.id} className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                      <p className="font-semibold">{formatPen(Number(row.costo_unitario ?? 0))}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(row.fecha)} · {row.referencia ?? "Sin proveedor"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">Sin compras registradas para este producto.</p>
                )}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold">Ultimos 10 movimientos del kardex</h3>
              <div className="mt-2 space-y-2">
                {selectedProductKardex.map((row) => (
                  <div key={row.id} className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
                    <p className="font-semibold">{row.tipo} · {row.impacto}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(row.fecha)} · {row.referencia ?? "Sin referencia"}</p>
                  </div>
                ))}
                {selectedProductKardex.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">Sin movimientos recientes.</p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </DetailDrawer>

      {!canMutate ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Tu rol está en solo lectura para operaciones de inventario. Puedes consultar métricas y reportes.
        </p>
      ) : null}
    </>
  );
}
