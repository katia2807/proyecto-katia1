import { navItems } from "@/lib/constants";
import type { AppRole } from "@/lib/supabase/types";

const maderaEditableRoles = new Set<AppRole>(["owner_admin", "gerencia", "ventas"]);
const cajaMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "operaciones_caja", "ventas"]);
const ventasMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "ventas"]);
const rrhhMutationRoles = new Set<AppRole>(["owner_admin", "gerencia", "rrhh"]);
const liderazgoRoles = new Set<AppRole>(["owner_admin", "gerencia"]);
const writerRoles = new Set<AppRole>(["owner_admin", "gerencia", "operaciones_caja", "ventas", "rrhh"]);

/** Roles UI nuevos (persistidos en `perfiles.ui_role`). Re-export tipo útil. */
export type UiRoleSlug = "owner_admin" | "operaciones" | "readonly";

/** Mapeo UI → columna `perfiles.role` (enum existente; sin cambiar tipos en BD). */
export function mapUiRoleToDbRole(ui: UiRoleSlug): AppRole {
  switch (ui) {
    case "owner_admin":
      return "owner_admin";
    case "operaciones":
      return "ventas";
    case "readonly":
      return "partner_readonly";
  }
}

/** Enlaces de navegación visibles según rol UI + rol legacy. */
export function buildNavHrefAllowlist(role: AppRole, uiRole: string | null): Set<string> {
  const allowed = new Set<string>(navItems.map((n) => n.href));

  const hide = (href: string) => {
    allowed.delete(href);
  };

  const isOwnerAdminUi = uiRole === "owner_admin" || (!uiRole && role === "owner_admin");

  const readonlyLike =
    uiRole === "readonly" || (!uiRole && role === "partner_readonly");

  if (readonlyLike) {
    hide("/caja");
    hide("/personal");
    hide("/reportes/antifraude");
  }

  if (uiRole === "operaciones") {
    hide("/reportes/antifraude");
    hide("/seguridad");
    hide("/admin/importar");
    hide("/admin/respaldo");
    hide("/cuenta");
    hide("/admin/usuarios");
  }

  if (!isOwnerAdminUi) {
    hide("/cuenta");
    hide("/admin/usuarios");
  }

  return allowed;
}

export function canManageOrganizationUsers(role: AppRole | null | undefined, uiRole?: string | null) {
  return uiRole === "owner_admin" || (!uiRole && role === "owner_admin");
}

export function canEditMaderaConversion(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "readonly") return false;
  if (uiRole === "operaciones" || uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? maderaEditableRoles.has(role) : false;
  }
  return false;
}

export function canMutateVentas(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "readonly") return false;
  if (uiRole === "operaciones" || uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? ventasMutationRoles.has(role) : false;
  }
  return false;
}

export function canMutateCaja(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "readonly") return false;
  if (uiRole === "operaciones" || uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? cajaMutationRoles.has(role) : false;
  }
  return false;
}

export function canMutateRRHH(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "readonly") return false;
  if (uiRole === "operaciones" || uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? rrhhMutationRoles.has(role) : false;
  }
  return false;
}

export function canMutateInventario(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "readonly") return false;
  if (uiRole === "operaciones" || uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? writerRoles.has(role) : false;
  }
  return false;
}

export function canCloseMonth(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "operaciones" || uiRole === "readonly") return false;
  if (uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? liderazgoRoles.has(role) : false;
  }
  return false;
}

/** Control socios + vistas “solo jefatura”. */
export function canAccessAntifraude(role: AppRole | null | undefined, uiRole?: string | null) {
  if (uiRole === "operaciones" || uiRole === "readonly") return false;
  if (uiRole === "owner_admin") return true;
  if (uiRole == null || uiRole === "") {
    return role ? liderazgoRoles.has(role) : false;
  }
  return false;
}

export function canAccessSeguridad(role: AppRole | null | undefined, uiRole?: string | null) {
  return canAccessAntifraude(role, uiRole);
}
