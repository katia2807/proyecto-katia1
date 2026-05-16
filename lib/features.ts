import { navItems } from "@/lib/constants";

export const FEATURES = {
  // V1 — INCLUIDOS
  inicio: true,
  caja: true,
  inventario: true,
  gerencial: true,
  ventas: true,
  /** Incluye cotizador, tabla de cotizaciones y tablero Kanban de órdenes de producción (`KanbanOrdenes`). */
  mueblesPersonalizados: true,
  cotizacion: true,
  registro: true, // simplificado
  alquilerMixer: true, // simplificado
  reportes: true, // simplificado
  cuentaAdmin: true,
  empresa: true,
  respaldo: true,
  usuarios: true,
  configuracion: true,
  ayuda: true,

  // V2 — OCULTOS (cobrar extra para activar)
  equipoPersonal: false,
  controlSocios: false,
  seguridad: false,
  importar: false,
  nominaCompleta: false,
  cierreMes: false,
  quoteDualFlow: false,
  zonasEntrega: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

type NavHref = (typeof navItems)[number]["href"];

/**
 * Reglas de menú lateral: `null` = siempre visible en producto (sujeto a permisos por rol).
 * Un array = visible si todas las features listadas están en true.
 */
const NAV_MENU_FEATURE: Record<NavHref, FeatureKey | readonly FeatureKey[] | null> = {
  "/": "inicio",
  "/caja": "caja",
  "/inventario": "inventario",
  "/gerencial": "gerencial",
  "/ventas": "ventas",
  "/ventas/clientes": "ventas",
  "/ventas/muebles-personalizados": ["ventas", "mueblesPersonalizados"],
  "/cotizacion": "cotizacion",
  "/registro": "registro",
  "/ventas/alquiler-mixer": ["ventas", "alquilerMixer"],
  "/personal": "equipoPersonal",
  "/reportes": "reportes",
  "/reportes/antifraude": "controlSocios",
  "/seguridad": "seguridad",
  "/cuenta": "cuentaAdmin",
  "/admin/empresa": "empresa",
  "/admin/importar": "importar",
  "/admin/respaldo": "respaldo",
  "/admin/usuarios": "usuarios",
  "/configuracion": "configuracion",
  "/ayuda": "ayuda",
};

function evalNavFeatureRule(rule: FeatureKey | readonly FeatureKey[] | null): boolean {
  if (rule === null) return true;
  if (typeof rule === "string") return FEATURES[rule];
  return rule.every((k) => FEATURES[k]);
}

/** Si el ítem debe aparecer en el menú según flags de producto (V1/V2). No reemplaza permisos por rol. */
export function isNavHrefAllowedByProductFeatures(href: string): boolean {
  const rule = NAV_MENU_FEATURE[href as NavHref];
  if (rule === undefined) return true;
  return evalNavFeatureRule(rule);
}
