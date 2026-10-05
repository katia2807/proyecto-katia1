const categorias = ["todas", "muebles", "madera", "aserradero", "alquileres", "otros"] as const;

export type HistorialCategoria = (typeof categorias)[number];

export const HISTORIAL_PAGE_SIZE = 50;

export function normalizeHistorialPaginas(value: string | null | undefined): number {
  const paginas = Number(value);
  return Number.isSafeInteger(paginas) && paginas > 0 && paginas <= Math.floor(Number.MAX_SAFE_INTEGER / HISTORIAL_PAGE_SIZE)
    ? paginas : 1;
}

export function normalizeHistorialCategoria(value: string | null | undefined): HistorialCategoria {
  return categorias.find((categoria) => categoria === value) ?? "todas";
}

export function buildHistorialHref(categoria: HistorialCategoria, busqueda: string, paginas = 1): string {
  const params = new URLSearchParams();
  if (categoria !== "todas") params.set("categoria", categoria);
  if (busqueda) params.set("buscar", busqueda);
  if (paginas > 1) params.set("historial", String(normalizeHistorialPaginas(String(paginas))));
  const query = params.toString();
  return `/ventas${query ? `?${query}` : ""}#historial-ventas`;
}

/** El regreso sólo puede apuntar al historial local, con sus filtros conocidos. */
export function safeHistorialHref(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw?.startsWith("/ventas")) {
    try {
      const url = new URL(raw, "https://katia.local");
      if (url.origin === "https://katia.local" && url.pathname === "/ventas") {
        return buildHistorialHref(normalizeHistorialCategoria(url.searchParams.get("categoria")), url.searchParams.get("buscar") ?? "", normalizeHistorialPaginas(url.searchParams.get("historial")));
      }
    } catch {
      // Un enlace incompleto vuelve al historial sin filtros.
    }
  }
  return buildHistorialHref("todas", "");
}

export function withHistorialReturn(href: string, historialHref: string): string {
  const url = new URL(href, "https://katia.local");
  url.searchParams.set("volver", safeHistorialHref(historialHref));
  return `${url.pathname}${url.search}${url.hash}`;
}
