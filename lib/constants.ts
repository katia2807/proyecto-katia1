export const DEFAULT_ORG_ID =
  process.env.ERP_ORG_ID ?? "00000000-0000-0000-0000-000000000001";

/** Módulos cuya persistencia en Supabase aún no está cableada. */
export const MODULO_PROXIMA_ACTUALIZACION_MSG =
  "Este módulo estará disponible en la próxima actualización.";

export const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/caja", label: "Caja" },
  { href: "/inventario", label: "Inventario" },
  { href: "/ventas", label: "Ventas" },
  { href: "/ventas/muebles-personalizados", label: "Muebles personalizados" },
  { href: "/cotizacion", label: "Cotización" },
  { href: "/registro", label: "Registro" },
  { href: "/ventas/alquiler-mixer", label: "Alquiler Mixer" },
  { href: "/personal", label: "Equipo" },
  { href: "/reportes", label: "Reportes" },
  { href: "/reportes/antifraude", label: "Control socios" },
  { href: "/checklist", label: "Checklist" },
  { href: "/seguridad", label: "Seguridad" },
  { href: "/cuenta", label: "Cuenta admin" },
  { href: "/admin/empresa", label: "Empresa" },
  { href: "/admin/importar", label: "Importar" },
  { href: "/admin/respaldo", label: "Respaldo" },
  { href: "/admin/usuarios", label: "Usuarios" },
] as const;
