import { navItems } from "@/lib/constants";
import { isNavHrefAllowedByProductFeatures } from "@/lib/features";

export type GlobalSearchType = "Apartado" | "Cliente" | "Producto" | "Cotizacion";
export type GlobalSearchItem = { label: string; detail: string; href: string; type: GlobalSearchType; keywords?: readonly string[] };
export const GLOBAL_SEARCH_TYPES: readonly GlobalSearchType[] = ["Apartado", "Cliente", "Producto", "Cotizacion"];
export const GLOBAL_SEARCH_LABELS: Record<GlobalSearchType, string> = { Apartado: "Apartados", Cliente: "Clientes", Producto: "Productos", Cotizacion: "Cotizaciones" };

const sectionDescriptions: Record<string, { detail: string; keywords: string[] }> = {
  "/caja": { detail: "Movimientos de dinero de la empresa", keywords: ["ingresos", "egresos", "entradas", "salidas", "dinero", "movimientos"] },
  "/ventas": { detail: "Ventas y comprobantes", keywords: ["vender", "venta", "boleta", "boletas", "comprobante", "factura"] },
  "/cotizacion": { detail: "Cotizaciones y presupuestos", keywords: ["cotizar", "presupuesto", "presupuestos", "precio", "propuesta"] },
  "/inventario": { detail: "Productos, existencias y Kardex", keywords: ["stock", "existencias", "catalogo", "productos", "reponer", "kardex"] },
  "/ventas/clientes": { detail: "Directorio de clientes y proveedores", keywords: ["cliente", "compradores", "proveedor", "proveedores", "chofer", "choferes"] },
  "/gerencial": { detail: "Análisis y seguimiento del negocio", keywords: ["negocio", "prioridades", "cobros", "cobrar", "deudas", "analisis", "indicadores"] },
  "/reportes": { detail: "Reportes y exportaciones", keywords: ["reporte", "exportar", "excel", "resumen"] },
  "/registro": { detail: "Registro general e historial", keywords: ["anotar", "anotaciones", "registro general", "historial"] },
  "/ventas/alquiler-mixer": { detail: "Contratos y alquileres", keywords: ["alquiler", "alquilar", "mixer", "bomba", "contratos"] },
  "/ventas/muebles-personalizados": { detail: "Pedidos y producción de muebles", keywords: ["mueble", "muebles", "pedidos", "produccion"] },
  "/admin/respaldo": { detail: "Copias y recuperación de datos", keywords: ["backup", "copia", "copias", "restaurar", "recuperar"] },
  "/personal": { detail: "Gestión de equipo y personal", keywords: ["empleado", "empleados", "personal", "sueldos", "adelantos"] },
  "/configuracion": { detail: "Preferencias y datos de la empresa", keywords: ["ajustes", "preferencias", "empresa"] },
  "/cuenta": { detail: "Tu perfil y acceso", keywords: ["perfil", "contraseña", "contrasena", "mi cuenta"] },
};
const preferred = ["/ventas", "/caja", "/cotizacion", "/inventario", "/ventas/clientes", "/gerencial", "/reportes", "/registro"];

export function buildGlobalSearchSections(allowedRoutes: ReadonlySet<string>): GlobalSearchItem[] {
  return navItems.filter(item => allowedRoutes.has(item.href) && isNavHrefAllowedByProductFeatures(item.href)).map(item => ({
    label: item.label, href: item.href, type: "Apartado", detail: sectionDescriptions[item.href]?.detail ?? "Abrir este apartado",
    keywords: sectionDescriptions[item.href]?.keywords ?? [],
  }));
}

export function normalizeGlobalSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Cupo por tipo: un directorio grande no oculta productos o cotizaciones. */
export function getGlobalSearchResults(records: readonly GlobalSearchItem[], sections: readonly GlobalSearchItem[], query: string): GlobalSearchItem[] {
  const q = normalizeGlobalSearch(query);
  if (q.length < 2) {
    return [...sections].filter(item => item.href !== "/").sort((a, b) => {
      const ai = preferred.indexOf(a.href), bi = preferred.indexOf(b.href);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    }).slice(0, 8);
  }
  const tokens = q.split(" ");
  const ranked = [...sections, ...records].map(item => {
    const label = normalizeGlobalSearch(item.label);
    const fields = [item.label, ...item.detail.split(" · "), GLOBAL_SEARCH_LABELS[item.type], ...(item.keywords ?? [])].map(normalizeGlobalSearch);
    const text = fields.join(" ");
    const compact = fields.map(field => field.replace(/\s/g, ""));
    if (!tokens.every(token => text.includes(token) || compact.some(field => field.includes(token)))) return null;
    const score = label === q ? 100 : label.startsWith(q) ? 80 : label.includes(q) ? 60 : 20;
    return { item, score };
  }).filter((row): row is { item: GlobalSearchItem; score: number } => row !== null).sort((a, b) => b.score - a.score);
  return GLOBAL_SEARCH_TYPES.flatMap(type => ranked.filter(row => row.item.type === type).slice(0, type === "Apartado" ? 5 : 4).map(row => row.item));
}

/** Solo navegación a rutas existentes; la autorización real sigue en cada destino. */
export function getGlobalSearchContinuations(query: string, allowedRoutes: ReadonlySet<string>) {
  const q = query.trim();
  if (normalizeGlobalSearch(q).length < 2) return [];
  const permitted = (path: string) => isNavHrefAllowedByProductFeatures(path) && [...allowedRoutes].some(href => href !== "/" && (path === href || path.startsWith(href + "/")));
  return [
    { label: "Buscar en todos los clientes", path: "/ventas/clientes", href: "/ventas/clientes?tab=compradores&q=" + encodeURIComponent(q) },
    { label: "Buscar en todo el catálogo", path: "/inventario", href: "/inventario?tab=productos&buscar=" + encodeURIComponent(q) },
    { label: "Ver todas las cotizaciones", path: "/cotizacion", href: "/cotizacion" },
  ].filter(link => permitted(link.path));
}

export function nextGlobalSearchIndex(current: number, count: number, direction: 1 | -1) {
  if (count === 0) return -1;
  return (current + direction + count) % count;
}
