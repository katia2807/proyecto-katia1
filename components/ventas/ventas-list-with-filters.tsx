"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReintentarButton } from "@/components/inicio/reintentar-button";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { AlertTriangle, Eye, Search } from "lucide-react";
import { buildHistorialHref, normalizeHistorialCategoria, withHistorialReturn, type HistorialCategoria } from "@/lib/ventas-historial-navigation";

const POSITION_KEY = "katia:ventas:historial:posicion:v1";

export type UnifiedVenta = {
  id: string;
  fecha: string;
  clienteNombre: string;
  concepto: string;
  total: number | null;
  categoria: "muebles" | "madera" | "aserradero" | "alquileres" | "otros";
  detalleHref: string;
};

type VentasListWithFiltersProps = {
  ventas: UnifiedVenta[];
  alquileresLoadFailed?: boolean;
  hasMore?: boolean;
  paginas?: number;
  failedCategories?: HistorialCategoria[];
  cotizacionesLoadFailed?: boolean;
};

export function VentasListWithFilters({ ventas, alquileresLoadFailed = false, hasMore = false, paginas = 1, failedCategories = [], cotizacionesLoadFailed = false }: VentasListWithFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeCategory = normalizeHistorialCategoria(searchParams.get("categoria"));
  const searchTerm = searchParams.get("buscar") ?? "";
  const historialHref = buildHistorialHref(activeCategory, searchTerm, paginas);
  const restoredPosition = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const categoriasFallidas = new Set(failedCategories);
  if (alquileresLoadFailed) categoriasFallidas.add("alquileres");
  const ventasDisponibles = ventas.filter((venta) => !categoriasFallidas.has(venta.categoria));
  const avisoCotizaciones = cotizacionesLoadFailed && activeCategory !== "madera";
  const mostrarAvisoCarga = avisoCotizaciones || (activeCategory === "todas" ? categoriasFallidas.size > 0 : categoriasFallidas.has(activeCategory));
  const soloFalloAlquiler = !avisoCotizaciones && categoriasFallidas.size === 1 && categoriasFallidas.has("alquileres");
  const soloFalloCotizaciones = avisoCotizaciones && categoriasFallidas.size === 0;

  // Restaura después de que Next haya terminado de montar la página de regreso.
  useEffect(() => {
    if (restoredPosition.current) return;
    const frame = requestAnimationFrame(() => {
      restoredPosition.current = true;
      try {
        const raw = sessionStorage.getItem(POSITION_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.href === historialHref && Number.isFinite(saved.top) && saved.top >= 0) {
          sessionStorage.removeItem(POSITION_KEY);
          window.scrollTo({ top: saved.top, behavior: "instant" });
          const table = document.getElementById("historial-ventas-tabla");
          if (table && Number.isFinite(saved.left) && saved.left >= 0) table.scrollLeft = saved.left;
          return;
        }
      } catch {
        // El historial también funciona si el navegador bloquea el almacenamiento.
      }
      if (window.location.hash.startsWith("#historial-ventas")) {
        document.getElementById("historial-ventas")?.scrollIntoView({ behavior: "instant", block: "start" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [historialHref]);

  function updateFilters(categoria: HistorialCategoria, busqueda: string) {
    const url = new URL(window.location.href);
    if (categoria === "todas") url.searchParams.delete("categoria");
    else url.searchParams.set("categoria", categoria);
    if (busqueda) url.searchParams.set("buscar", busqueda);
    else url.searchParams.delete("buscar");
    url.hash = "historial-ventas";
    // La API de historial actualiza useSearchParams sin volver a cargar los datos.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function rememberPosition(href = historialHref) {
    try {
      sessionStorage.setItem(POSITION_KEY, JSON.stringify({
        href,
        top: window.scrollY,
        left: document.getElementById("historial-ventas-tabla")?.scrollLeft ?? 0,
      }));
    } catch {
      // Los filtros siguen viajando en el enlace aunque no se guarde la posición.
    }
  }

  function clearFilters() {
    updateFilters("todas", "");
    searchInput.current?.focus();
  }

  function loadMore() {
    const url = new URL(window.location.href);
    url.searchParams.set("historial", String(paginas + 1));
    url.hash = "historial-ventas";
    rememberPosition(buildHistorialHref(activeCategory, searchTerm, paginas + 1));
    startTransition(() => router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false }));
  }

  const categories = [
    { id: "todas", label: "Todas" },
    { id: "muebles", label: "Muebles" },
    { id: "madera", label: "Madera" },
    { id: "aserradero", label: "Aserradero" },
    { id: "alquileres", label: "Alquileres" },
    { id: "otros", label: "Otros" },
  ];

  const busquedaNormalizada = searchTerm.trim().toLowerCase();
  const ventasBusqueda = ventasDisponibles.filter((venta) =>
    venta.clienteNombre.toLowerCase().includes(busquedaNormalizada) ||
    venta.concepto.toLowerCase().includes(busquedaNormalizada),
  );
  const filteredVentas = ventasBusqueda.filter((venta) => activeCategory === "todas" || venta.categoria === activeCategory);
  const hayFiltros = activeCategory !== "todas" || searchTerm.length > 0;
  const cantidadResultados = filteredVentas.length === 1
    ? "1 operación encontrada" : `${filteredVentas.length} operaciones encontradas`;
  const resumenResultados = categoriasFallidas.has(activeCategory) && activeCategory !== "todas"
    ? `Resultados de ${activeCategory} no disponibles`
    : `${cantidadResultados}${mostrarAvisoCarga ? " en los datos disponibles" : hasMore ? " en las operaciones cargadas" : ""}`;

  const getCategoryBadgeClass = (categoria: string) => {
    switch (categoria) {
      case "muebles":
        return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300";
      case "madera":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
      case "aserradero":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
      case "alquileres":
        return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";
      default:
        return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-300";
    }
  };

  return (
    <Card id="historial-ventas" className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-[var(--color-text-primary)]">
              Historial Unificado de Ventas
            </CardTitle>
            <CardDescription className="text-sm text-[var(--color-text-secondary)]">
              Consulta las operaciones recientes por cliente, concepto o categoría.
            </CardDescription>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              El total es el importe de la operación; no indica cuánto se ha cobrado.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              ref={searchInput}
              type="text"
              aria-label="Buscar en el historial de ventas"
              placeholder="Buscar por cliente o concepto..."
              value={searchTerm}
              disabled={isPending}
              onChange={(e) => updateFilters(activeCategory, e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
            />
          </div>
        </div>

        {/* Categories Tab Selector */}
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const noDisponible = categoriasFallidas.has(normalizeHistorialCategoria(cat.id));
            const count = cat.id === "todas"
              ? ventasBusqueda.length
              : ventasBusqueda.filter((venta) => venta.categoria === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => updateFilters(normalizeHistorialCategoria(cat.id), searchTerm)}
                type="button"
                disabled={isPending}
                aria-pressed={isActive}
                aria-label={noDisponible ? `${cat.label}: datos sin cargar` : undefined}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all select-none border ${
                  isActive
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-sm scale-[1.02]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-primary-soft)]/20 hover:text-[var(--color-text-primary)]"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                  }`}
                >
                  {noDisponible ? "—" : count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-[var(--color-text-secondary)]">
            {resumenResultados}
          </p>
          {hayFiltros && (filteredVentas.length > 0 || mostrarAvisoCarga) ? (
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters} disabled={isPending}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {mostrarAvisoCarga ? (
        <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{soloFalloCotizaciones ? "No pudimos cargar las cotizaciones cobradas." : soloFalloAlquiler ? "No pudimos cargar los alquileres." : "No pudimos cargar todas las operaciones."}</p>
              <p className="mt-1 text-sm">
                {activeCategory === "todas" || soloFalloCotizaciones
                  ? "El historial está incompleto. Las demás operaciones que se cargaron siguen disponibles."
                  : soloFalloAlquiler ? "Reintenta para consultar los contratos. No podemos confirmar los resultados de esta categoría."
                  : "Reintenta para consultar las operaciones. No podemos confirmar los resultados de esta categoría."}
              </p>
            </div>
          </div>
          <ReintentarButton />
        </div>
      ) : null}

      <div id="historial-ventas-tabla" className="overflow-x-auto" aria-busy={isPending}>
        {mostrarAvisoCarga && filteredVentas.length === 0 ? null : (
        <Table>
          <THead>
            <TRow>
              <TH className="w-[120px]">Fecha</TH>
              <TH className="w-[200px]">Cliente</TH>
              <TH className="w-[130px]">Categoría</TH>
              <TH>Detalle / Concepto</TH>
              <TH className="min-w-[160px] text-right">Total de la operación</TH>
              <TH className="w-[140px]">Detalle</TH>
            </TRow>
          </THead>
          <tbody>
            {filteredVentas.map((venta) => (
              <TRow key={venta.detalleHref} className="transition-all hover:bg-[var(--color-primary-soft)]/10">
                <TD className="whitespace-nowrap font-medium text-[var(--color-text-secondary)]">
                  {formatDate(venta.fecha)}
                </TD>
                <TD className="font-semibold text-[var(--color-text-primary)]">
                  {venta.clienteNombre}
                </TD>
                <TD>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getCategoryBadgeClass(venta.categoria)}`}>
                    {venta.categoria}
                  </span>
                </TD>
                <TD className="text-sm text-[var(--color-text-secondary)]">
                  {venta.concepto}
                </TD>
                <TD className="text-right font-bold text-[var(--color-text-primary)]">
                  {venta.total == null ? <span className="text-sm font-medium text-[var(--color-text-secondary)]">Total por definir</span> : formatPen(venta.total)}
                </TD>
                <TD>
                  <Link
                    href={withHistorialReturn(venta.detalleHref, historialHref)}
                    onNavigate={() => rememberPosition()}
                    prefetch={false}
                    aria-label={`Ver detalle: ${venta.concepto}, ${venta.clienteNombre}`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    Ver detalle
                  </Link>
                </TD>
              </TRow>
            ))}

            {filteredVentas.length === 0 && (
              <TRow>
                <TD colSpan={6} className="py-8 text-center text-[var(--color-text-secondary)]">
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {hayFiltros ? hasMore ? "No hay coincidencias en las operaciones cargadas." : "No hay resultados con estos filtros." : "No hay operaciones para mostrar."}
                  </p>
                  {hayFiltros ? (
                    <>
                      <p className="mt-2 text-sm">{hasMore ? "Consulta más operaciones anteriores o limpia los filtros para cambiar la búsqueda." : "Prueba otra búsqueda o limpia los filtros para ver las operaciones."}</p>
                      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={clearFilters} disabled={isPending}>
                        Limpiar filtros
                      </Button>
                    </>
                  ) : null}
                </TD>
              </TRow>
            )}
          </tbody>
        </Table>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-4">
        <p className="text-sm text-[var(--color-text-secondary)]" role="status" aria-live="polite">
          {hasMore ? `${ventasDisponibles.length} operaciones cargadas. Hay más operaciones anteriores por consultar.`
            : categoriasFallidas.size > 0 || cotizacionesLoadFailed ? "No podemos confirmar el final del historial hasta completar la carga."
            : "Llegaste al final del historial."}
        </p>
        {hasMore ? (
          <Button type="button" variant="secondary" onClick={loadMore} disabled={isPending} aria-busy={isPending}>
            {isPending ? "Cargando operaciones…" : "Ver más operaciones"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
