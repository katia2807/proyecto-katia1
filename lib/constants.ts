/** UUID de organización por defecto (seed / demo). Debe coincidir con migraciones si no cambiás org. */
const SEED_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";

const UUID_HEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveDefaultOrgId(): string {
  const raw = process.env.ERP_ORG_ID?.trim();
  // En Vercel a veces `ERP_ORG_ID=` queda como "" — eso rompe `.eq("organization_id", …)` en Postgres.
  if (!raw) {
    return SEED_ORGANIZATION_ID;
  }
  if (!UUID_HEX.test(raw)) {
    console.warn(
      "[constants] ERP_ORG_ID no es un UUID válido; se usa el org por defecto del seed.",
    );
    return SEED_ORGANIZATION_ID;
  }
  return raw;
}

export const DEFAULT_ORG_ID = resolveDefaultOrgId();

/** Módulos cuya persistencia en Supabase aún no está cableada. */
export const MODULO_PROXIMA_ACTUALIZACION_MSG =
  "Este módulo estará disponible en la próxima actualización.";

/** Listado maestro del menú lateral. La visibilidad por producto (V1/V2) se aplica en `lib/features.ts` + `buildNavHrefAllowlist`. */
export const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/caja", label: "Caja" },
  { href: "/inventario", label: "Inventario" },
  { href: "/gerencial", label: "Centro de Mando" },
  { href: "/ventas", label: "Ventas" },
  { href: "/ventas/clientes", label: "Clientes" },
  { href: "/ventas/muebles-personalizados", label: "Muebles personalizados" },
  { href: "/cotizacion", label: "Cotizaciones" },
  { href: "/registro", label: "Registro" },
  { href: "/ventas/alquiler-mixer", label: "Alquiler Mixer" },
  { href: "/personal", label: "Equipo" },
  { href: "/reportes", label: "Reportes" },
  { href: "/reportes/antifraude", label: "Control" },
  { href: "/seguridad", label: "Seguridad" },
  { href: "/cuenta", label: "Mi cuenta" },
  { href: "/admin/empresa", label: "Empresa" },
  { href: "/admin/importar", label: "Importar datos" },
  { href: "/admin/respaldo", label: "Respaldo" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/configuracion", label: "Configuración" },
  { href: "/ayuda", label: "Ayuda" },
] as const;
