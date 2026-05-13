"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { mapUiRoleToDbRole, type UiRoleSlug } from "@/lib/permissions";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";

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
  ui_role: UiRoleSlug | null;
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
  await requireOwnerAdminUi();
  if (!hasSupabaseEnv()) {
    return { data: [], error: null };
  }

  const supabase = getSupabaseServerClient();
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("id,user_id,full_name,role,ui_role,deactivated_at")
    .eq("organization_id", DEFAULT_ORG_ID)
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
    ui_role:
      p.ui_role === "owner_admin" || p.ui_role === "operaciones" || p.ui_role === "readonly"
        ? p.ui_role
        : null,
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
  uiRole: UiRoleSlug;
}) {
  await requireOwnerAdminUi();
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !fullName) {
    return { ok: false as const, error: "Correo y nombre son obligatorios." };
  }
  if (input.uiRole === "owner_admin") {
    return {
      ok: false as const,
      error: "No se pueden crear nuevas cuentas con rol dueña desde esta pantalla.",
    };
  }
  if (!hasSupabaseEnv()) {
    return { ok: false as const, error: "Gestión de usuarios requiere Supabase." };
  }

  const supabase = getSupabaseServerClient();
  const dbRole = mapUiRoleToDbRole(input.uiRole);

  const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appOrigin()}/login`,
    data: { full_name: fullName },
  });

  if (invErr || !invited?.user?.id) {
    return { ok: false as const, error: invErr?.message ?? "No se pudo enviar la invitación." };
  }

  const userId = invited.user.id;

  const { error: insErr } = await supabase.from("perfiles").insert({
    user_id: userId,
    organization_id: DEFAULT_ORG_ID,
    role: dbRole,
    full_name: fullName,
    ui_role: input.uiRole,
  });

  if (insErr) {
    await supabase.auth.admin.deleteUser(userId);
    return { ok: false as const, error: insErr.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true as const };
}

export async function updateOrganizationUser(input: {
  userId: string;
  fullName: string;
  uiRole: UiRoleSlug;
}) {
  const ctx = await requireOwnerAdminUi();

  if (input.userId === ctx.userId) {
    const selfProfile = await getSupabaseServerClient()
      .from("perfiles")
      .select("ui_role")
      .eq("user_id", ctx.userId)
      .eq("organization_id", DEFAULT_ORG_ID)
      .maybeSingle();
    const selfUi = selfProfile.data?.ui_role;
    if (selfUi === "owner_admin" || (!selfUi && ctx.role === "owner_admin")) {
      if (input.uiRole !== "owner_admin") {
        return { ok: false as const, error: "No puedes quitarte el rol de dueña a ti misma." };
      }
    }
  }

  if (!hasSupabaseEnv()) {
    return { ok: false as const, error: "Supabase no configurado." };
  }

  const supabase = getSupabaseServerClient();
  const dbRole = mapUiRoleToDbRole(input.uiRole);

  const { error } = await supabase
    .from("perfiles")
    .update({
      full_name: input.fullName.trim(),
      role: dbRole,
      ui_role: input.uiRole,
    })
    .eq("user_id", input.userId)
    .eq("organization_id", DEFAULT_ORG_ID);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  await supabase.auth.admin.updateUserById(input.userId, {
    user_metadata: { full_name: input.fullName.trim() },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true as const };
}

export async function setOrganizationUserActive(input: { userId: string; active: boolean }) {
  const ctx = await requireOwnerAdminUi();

  if (input.userId === ctx.userId && !input.active) {
    return { ok: false as const, error: "No puedes desactivar tu propia sesión." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false as const, error: "Supabase no configurado." };
  }

  const supabase = getSupabaseServerClient();

  const { data: targetProfile } = await supabase
    .from("perfiles")
    .select("ui_role,role")
    .eq("user_id", input.userId)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!targetProfile) {
    return { ok: false as const, error: "Usuario no encontrado." };
  }

  if (!input.active) {
    const { data: ownersRows } = await supabase
      .from("perfiles")
      .select("user_id,ui_role,role,deactivated_at")
      .eq("organization_id", DEFAULT_ORG_ID);

    const activeOwners = (ownersRows ?? []).filter((o) => {
      if (o.deactivated_at) return false;
      return o.ui_role === "owner_admin" || (!o.ui_role && o.role === "owner_admin");
    });
    if (
      activeOwners.length === 1 &&
      activeOwners[0]?.user_id === input.userId &&
      (targetProfile.ui_role === "owner_admin" ||
        (!targetProfile.ui_role && targetProfile.role === "owner_admin"))
    ) {
      return { ok: false as const, error: "Debe existir al menos una dueña activa." };
    }
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("perfiles")
    .update({
      deactivated_at: input.active ? null : nowIso,
    })
    .eq("user_id", input.userId)
    .eq("organization_id", DEFAULT_ORG_ID);

  if (upErr) {
    return { ok: false as const, error: upErr.message };
  }

  const { error: banErr } = await supabase.auth.admin.updateUserById(input.userId, {
    ban_duration: input.active ? "none" : "876000h",
  });
  if (banErr) {
    return { ok: false as const, error: banErr.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true as const };
}

function parseUiRole(v: string): UiRoleSlug | null {
  if (v === "owner_admin" || v === "operaciones" || v === "readonly") return v;
  return null;
}

/** Wrapper para `<form action>` con `useActionState` — mensajes visibles sin lanzar. */
export async function createOrganizationUserForm(
  _prevState: OrgUsersFormState,
  formData: FormData,
): Promise<OrgUsersFormState> {
  const ui = parseUiRole(String(formData.get("ui_role") ?? ""));
  if (!ui) return { error: "Selecciona un rol válido.", success: false };
  const result = await createOrganizationUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    uiRole: ui,
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
  const ui = parseUiRole(String(formData.get("ui_role") ?? ""));
  if (!ui) return { error: "Selecciona un rol válido." };
  const result = await updateOrganizationUser({
    userId: String(formData.get("user_id") ?? ""),
    fullName: String(formData.get("full_name") ?? ""),
    uiRole: ui,
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
