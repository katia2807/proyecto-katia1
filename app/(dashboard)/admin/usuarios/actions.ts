"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import type { AssignableRole } from "@/lib/permissions";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";
import { manageOrganizationUser } from "@/lib/organization-user-management";

async function requireOwnerAdminUi() {
  const ctx = await requireAuthContext({ redirectTo: null });
  if (!ctx) {
    throw new Error("Sesión inválida.");
  }
  const ok =
    ctx.uiRole === "owner_admin" ||
    (!ctx.uiRole && ctx.role === "owner_admin");
  if (!ok) {
    throw new Error("Solo la dueña (owner_admin) puede gestionar usuarios.");
  }
  return ctx;
}

function appOrigin() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return base;
}

export type OrgUserRow = {
  perfil_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  ui_role: string | null;
  deactivated_at: string | null;
};

/** Resultado de listar usuarios: distingue lista vacía (`error: null`) de fallo al leer perfiles o Auth. */
export type OrganizationUsersListResult = {
  data: OrgUserRow[];
  error: string | null;
};

export type OrgUsersFormState = {
  error: string | null;
  /** Solo invitación: éxito para toast y reset del formulario. */
  success?: boolean;
  message?: string | null;
};

export async function listOrganizationUsers(): Promise<OrganizationUsersListResult> {
  const ctx = await requireOwnerAdminUi();
  if (!hasSupabaseEnv()) {
    return { data: [], error: null };
  }

  const supabase = getSupabaseServerClient();
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("id,user_id,full_name,role,ui_role,deactivated_at")
    .eq("organization_id", ctx.organizationId)
    .order("full_name", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = perfiles ?? [];
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  const emailByUserId = new Map<string, string | null>();
  let page = 1;
  const perPage = 200;
  let authListError: string | null = null;

  for (;;) {
    const { data: usersPage, error: listErr } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listErr) {
      authListError = listErr.message;
      break;
    }
    const users = usersPage?.users ?? [];
    for (const u of users) {
      emailByUserId.set(u.id, u.email ?? null);
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }

  const data: OrgUserRow[] = rows.map((p) => ({
    perfil_id: p.id,
    user_id: p.user_id,
    email: emailByUserId.get(p.user_id) ?? null,
    full_name: p.full_name,
    role: p.role,
    ui_role: p.ui_role,
    deactivated_at: p.deactivated_at,
  }));

  return {
    data,
    error: authListError ? `No se pudieron cargar todos los correos desde Auth: ${authListError}` : null,
  };
}

export async function createOrganizationUser(input: {
  email: string;
  fullName: string;
  role: AssignableRole;
}) {
  const ctx = await requireOwnerAdminUi();
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!parseRole(input.role)) return { ok: false as const, error: "Selecciona un rol válido." };
  if (!email || !fullName) {
    return { ok: false as const, error: "Correo y nombre son obligatorios." };
  }
  if (input.role === "owner_admin") {
    return {
      ok: false as const,
      error: "No se pueden crear nuevas cuentas con rol dueña desde esta pantalla.",
    };
  }
  if (!hasSupabaseEnv()) {
    return { ok: false as const, error: "Gestión de usuarios requiere Supabase." };
  }

  const result = await manageOrganizationUser(getSupabaseServerClient(), ctx, {
    type: "invitar", data: { email, full_name: fullName, role: input.role },
    redirectTo: `${appOrigin()}/login`,
  });
  revalidatePath("/admin/usuarios");
  return result;
}

export async function updateOrganizationUser(input: { userId: string; fullName: string; role: AssignableRole | "conservar" }) {
  const ctx = await requireOwnerAdminUi();
  if (!hasSupabaseEnv()) return { ok: false as const, error: "Supabase no configurado." };
  const name = input.fullName.trim();
  if (name.length < 2 || (input.role !== "conservar" && !parseRole(input.role))) return { ok: false as const, error: "Revisa el nombre y el rol." };
  if (input.userId === ctx.userId && input.role !== "conservar" && input.role !== "owner_admin") {
    return { ok: false as const, error: "No puedes quitarte el permiso de dueña." };
  }
  const result = await manageOrganizationUser(getSupabaseServerClient(), ctx, {
    type: "perfil", userId: input.userId, data: { full_name: name, role: input.role },
  });
  revalidatePath("/admin/usuarios");
  return result;
}

export async function setOrganizationUserActive(input: { userId: string; active: boolean }) {
  const ctx = await requireOwnerAdminUi();
  if (input.userId === ctx.userId && !input.active) return { ok: false as const, error: "No puedes desactivar tu propia sesión." };
  if (!hasSupabaseEnv()) return { ok: false as const, error: "Supabase no configurado." };
  const result = await manageOrganizationUser(getSupabaseServerClient(), ctx, {
    type: "estado", userId: input.userId, data: { active: input.active },
  });
  revalidatePath("/admin/usuarios");
  return result;
}

function parseRole(v: string): AssignableRole | null {
  if (v === "owner_admin" || v === "gerencia" || v === "vendedor" || v === "almacen" || v === "caja") return v;
  return null;
}

/** Wrapper para `<form action>` con `useActionState` — mensajes visibles sin lanzar. */
export async function createOrganizationUserForm(
  _prevState: OrgUsersFormState,
  formData: FormData,
): Promise<OrgUsersFormState> {
  const role = parseRole(String(formData.get("role") ?? ""));
  if (!role) return { error: "Selecciona un rol válido.", success: false };
  const result = await createOrganizationUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    role,
  });
  if (!result.ok) return { error: result.error, success: false };
  return {
    error: null,
    success: true,
    message: "Invitación enviada. El usuario recibirá un correo para acceder.",
  };
}

export async function updateOrganizationUserForm(
  _prevState: OrgUsersFormState,
  formData: FormData,
): Promise<OrgUsersFormState> {
  const rawRole = String(formData.get("role") ?? "");
  const role = rawRole === "conservar" ? "conservar" : parseRole(rawRole);
  if (!role) return { error: "Selecciona un rol válido." };
  const result = await updateOrganizationUser({
    userId: String(formData.get("user_id") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    role,
  });
  if (!result.ok) return { error: result.error };
  return { error: null };
}

export async function setOrganizationUserActiveForm(
  _prevState: OrgUsersFormState,
  formData: FormData,
): Promise<OrgUsersFormState> {
  const result = await setOrganizationUserActive({
    userId: String(formData.get("user_id") ?? ""),
    active: String(formData.get("active") ?? "") === "true",
  });
  if (!result.ok) return { error: result.error };
  return { error: null };
}
