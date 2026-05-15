import { navItems } from "@/lib/constants";
import { isNavHrefAllowedByProductFeatures } from "@/lib/features";
import type { AppRole } from "@/lib/supabase/types";

const cajaMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "caja", "operaciones_caja"]);
const ventasMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "ventas"]);
const rrhhMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "rrhh"]);
const liderazgoRoles = new Set<AppRole>(["owner_admin", "gerencia"]);
const inventarioMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "almacen", "ventas"]);
const registroMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "almacen"]);

/** Roles UI nuevos (persistidos en `perfiles.ui_role`). Re-export tipo útil. */
export type UiRoleSlug = "owner_admin" | "operaciones" | "readonly";

export type AssignableRole = "owner_admin" | "gerencia" | "vendedor" | "almacen" | "caja";

export function roleLabel(role: AssignableRole): string {
  switch (role) {
    case "owner_admin":
      return "Dueña (owner_admin)";
    case "gerencia":
      return "Gerencia";
    case "vendedor":
      return "Vendedor (solo lectura comercial)";
    case "almacen":
      return "Almacén";
    case "caja":
      return "Caja";
  }
}

/** Normaliza contexto actual (legacy + nuevo esquema) hacia rol efectivo para permisos. */
function resolveRole(role: AppRole, uiRole?: string | null): AppRole {
  if (uiRole === "owner_admin") return "owner_admin";
  if (uiRole === "operaciones") return "gerencia";
  if (uiRole === "readonly") return "vendedor";
  if (role === "partner_readonly") return "vendedor";
  if (role === "operaciones_caja") return "caja";
  return role;
}

/** Enlaces de navegación visibles según rol UI + rol legacy. */
export function buildNavHrefAllowlist(role: AppRole, uiRole: string | null): Set<string> {
  const allowed = new Set<string>(
    navItems.filter((n) => isNavHrefAllowedByProductFeatures(n.href)).map((n) => n.href),
  );

  const effectiveRole = resolveRole(role, uiRole);
  const navByRole: Record<AppRole, readonly string[]> = {
    owner_admin: navItems.map((n) => n.href),
    gerencia: navItems
      .map((n) => n.href)
      .filter((href) => href !== "/admin/usuarios"),
    vendedor: ["/", "/ventas", "/ventas/muebles-personalizados", "/cotizacion", "/caja"],
    almacen: ["/", "/inventario", "/registro"],
    caja: ["/", "/caja"],
    ventas: ["/", "/ventas", "/ventas/muebles-personalizados", "/cotizacion", "/caja", "/inventario"],
    operaciones_caja: ["/", "/caja"],
    rrhh: ["/"],
    partner_readonly: ["/"],
  };
  const roleNav = new Set(navByRole[effectiveRole] ?? ["/"]);
  for (const href of [...allowed]) {
    if (!roleNav.has(href)) {
      allowed.delete(href);
    }
  }

  return allowed;
}

export function canManageOrganizationUsers(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return resolveRole(role, uiRole) === "owner_admin";
}

export function canEditMaderaConversion(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  const effectiveRole = resolveRole(role, uiRole);
  return effectiveRole === "owner_admin" || effectiveRole === "gerencia" || effectiveRole === "ventas";
}

export function canMutateVentas(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return ventasMutationRoles.has(resolveRole(role, uiRole));
}

export function canMutateCaja(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return cajaMutationRoles.has(resolveRole(role, uiRole));
}

export function canMutateRRHH(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return rrhhMutationRoles.has(resolveRole(role, uiRole));
}

export function canMutateInventario(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return inventarioMutationRoles.has(resolveRole(role, uiRole));
}

export function canMutateRegistro(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return registroMutationRoles.has(resolveRole(role, uiRole));
}

export function canCloseMonth(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return liderazgoRoles.has(resolveRole(role, uiRole));
}

/** Control socios + vistas “solo jefatura”. */
export function canAccessAntifraude(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return liderazgoRoles.has(resolveRole(role, uiRole));
}

export function canAccessSeguridad(role: AppRole | null | undefined, uiRole?: string | null) {
  return canAccessAntifraude(role, uiRole);
}

export function canAccessGerencial(role: AppRole | null | undefined, uiRole?: string | null) {
  if (!role) return false;
  return liderazgoRoles.has(resolveRole(role, uiRole));
}

/** Misma regla que `GET /api/export/reportes-excel` (owner_admin, gerencia). */
export function canExportReportesExcel(role: AppRole | null | undefined) {
  return role === "owner_admin" || role === "gerencia";
}

export function canAccessPath(role: AppRole, uiRole: string | null, pathname: string): boolean {
  const allowlist = buildNavHrefAllowlist(role, uiRole);
  if (pathname === "/") return true;
  if ([...allowlist].some((href) => href !== "/" && (pathname === href || pathname.startsWith(`${href}/`)))) {
    return true;
  }

  const effectiveRole = resolveRole(role, uiRole);
  if (effectiveRole === "vendedor" || effectiveRole === "ventas") {
    return pathname.startsWith("/ventas/clientes");
  }
  return false;
}
