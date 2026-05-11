import { navItems } from "@/lib/constants";

export const FEATURES = {
  // V1 — INCLUIDOS
  caja: true,
  clientes: true,
  inventario: true,
  maderaCortada: true,
  aserradero: true,
  alquilerMixer: true,
  cotizacionUnificada: true,
  mueblesTerminados: true,
  personal: true,
  reportesBasicos: true,

  // V2 — OCULTOS (cambiar a true para activar)
  mueblesPersonalizados: false,
  cierreMes: false,
  antifraude: false,
  importarDatos: false,
  respaldoAdmin: false,
  nominaCompleta: false,
  quoteDualFlow: false,
  zonasEntrega: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

type NavHref = (typeof navItems)[number]["href"];

/**
 * Reglas de menú lateral: `null` = siempre visible (sujeto a permisos por rol).
 * Un array = visible si alguna de las features está en true.
 */
const NAV_MENU_FEATURE: Record<NavHref, FeatureKey | readonly FeatureKey[] | null> = {
  "/": null,
  "/caja": "caja",
  "/inventario": "inventario",
  "/ventas": [
    "clientes",
    "maderaCortada",
    "aserradero",
    "alquilerMixer",
    "mueblesTerminados",
    "mueblesPersonalizados",
  ],
  "/ventas/muebles-personalizados": "mueblesPersonalizados",
  "/cotizacion": "cotizacionUnificada",
  "/registro": null,
  "/ventas/alquiler-mixer": "alquilerMixer",
  "/personal": "personal",
  "/reportes": "reportesBasicos",
  "/reportes/antifraude": "antifraude",
  "/seguridad": null,
  "/cuenta": null,
  "/admin/empresa": null,
  "/admin/importar": "importarDatos",
  "/admin/respaldo": "respaldoAdmin",
  "/admin/usuarios": null,
};

function evalNavFeatureRule(rule: FeatureKey | readonly FeatureKey[] | null): boolean {
  if (rule === null) return true;
  if (typeof rule === "string") return FEATURES[rule];
  return rule.some((k) => FEATURES[k]);
}

/** Si el ítem debe aparecer en el menú según flags de producto (V1/V2). No reemplaza permisos por rol. */
export function isNavHrefAllowedByProductFeatures(href: string): boolean {
  const rule = NAV_MENU_FEATURE[href as NavHref];
  if (rule === undefined) return true;
  return evalNavFeatureRule(rule);
}
