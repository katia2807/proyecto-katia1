import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient, User, AdminUserAttributes } from "@supabase/supabase-js";

type ProfileSnapshot = { full_name: string | null; role: string; ui_role: string | null; deactivated_at: string | null };
type ManagementTicket = {
  id: string; estado: "pendiente" | "confirmada" | "revertida"; error: string | null;
  anterior: ProfileSnapshot | null; actual: ProfileSnapshot | null;
};
type ManagementInput = { type: "invitar" | "perfil" | "estado"; userId?: string; data: Record<string, unknown>; redirectTo?: string };
type ManagementResult = { ok: true } | { ok: false; error: string };
const pendingError = "No se pudo confirmar el cambio de acceso. La gestión de usuarios queda pendiente de revisión; se conservaron las cuentas. Revisa el usuario antes de continuar.";

function bannedUntil(user: User) {
  const value = (user as User & { banned_until?: string | null }).banned_until;
  return value ? new Date(value).getTime() : 0;
}

function sameAccess(before: User, after: User, type: ManagementInput["type"]) {
  if (type === "perfil") return (before.user_metadata?.full_name ?? null) === (after.user_metadata?.full_name ?? null);
  const previous = bannedUntil(before), current = bannedUntil(after);
  if (previous <= Date.now()) return current <= Date.now();
  return Number.isFinite(previous) && Number.isFinite(current) && Math.abs(previous - current) < 3000;
}

/** Solo esta gestión puede compensarse; nunca elimina una identidad de Auth. */
export async function manageOrganizationUser(
  supabase: SupabaseClient,
  context: { organizationId: string; userId: string },
  input: ManagementInput,
): Promise<ManagementResult> {
  const key = randomUUID();
  const identity = { p_org: context.organizationId, p_actor: context.userId, p_clave: key };
  let ticket: ManagementTicket;
  try {
    const { data, error } = await supabase.rpc("iniciar_gestion_usuario_segura", {
      ...identity, p_usuario: input.userId ?? null, p_tipo: input.type, p_datos: input.data,
    });
    if (error || !data) {
      return { ok: false, error: error?.code === "PGRST202" || error?.code === "42883"
        ? "Falta instalar la actualización de Usuarios. No se hicieron cambios."
        : error?.message ?? "No se pudo iniciar la gestión. No se hicieron cambios." };
    }
    ticket = data as ManagementTicket;
  } catch {
    return { ok: false, error: "No se pudo confirmar el inicio de la gestión. Revisa Usuarios antes de reintentar." };
  }

  // La finalización es idempotente: una respuesta perdida no repite el cambio.
  const finish = async (confirm: boolean, invitedId: string | null = null): Promise<ManagementTicket | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase.rpc("finalizar_gestion_usuario_segura", {
          ...identity, p_confirmar: confirm, p_invitado: invitedId,
        });
        if (!error && data) return data as ManagementTicket;
      } catch { /* Conservar la reserva si no se conoce el resultado. */ }
    }
    return null;
  };
  const finishedResult = (result: ManagementTicket | null): ManagementResult => {
    if (result?.estado === "confirmada") return { ok: true };
    return { ok: false, error: result?.error ?? pendingError };
  };
  if (ticket.estado !== "pendiente") return finishedResult(ticket);

  if (input.type === "invitar") {
    try {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(String(input.data.email), {
        redirectTo: input.redirectTo, data: { full_name: input.data.full_name },
      });
      if (error || !data.user?.id) {
        const reverted = await finish(false);
        return { ok: false, error: reverted ? error?.message ?? "No se pudo enviar la invitación." : pendingError };
      }
      return finishedResult(await finish(true, data.user.id));
    } catch {
      // La invitación pudo haberse enviado aunque se perdiera la respuesta.
      // No eliminar cuentas ni liberar una gestión cuyo resultado se desconoce.
      return { ok: false, error: pendingError };
    }
  }

  const userId = input.userId!;
  let previousAuth: User;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user || data.user.id !== userId) {
      const reverted = await finish(false);
      return { ok: false, error: reverted ? "No se pudo comprobar la cuenta de acceso. Se recuperó el perfil anterior." : pendingError };
    }
    previousAuth = data.user;
  } catch {
    const reverted = await finish(false);
    return { ok: false, error: reverted ? "No se pudo comprobar la cuenta de acceso. Se recuperó el perfil anterior." : pendingError };
  }

  const change: AdminUserAttributes = input.type === "perfil"
    ? { user_metadata: { full_name: ticket.actual!.full_name } }
    : { ban_duration: input.data.active ? "none" : "876000h" };
  let authSucceeded = false;
  try { authSucceeded = !(await supabase.auth.admin.updateUserById(userId, change)).error; } catch { /* Resultado incierto. */ }
  if (authSucceeded) return finishedResult(await finish(true));

  // Una respuesta fallida puede haber aplicado el cambio. Confirmar o restaurar
  // únicamente el campo de Auth de esta gestión antes de revertir el perfil.
  try {
    let read = await supabase.auth.admin.getUserById(userId);
    if (read.error || !read.data.user) return { ok: false, error: pendingError };
    if (!sameAccess(previousAuth, read.data.user, input.type)) {
      const until = bannedUntil(previousAuth);
      if (!Number.isFinite(until)) return { ok: false, error: pendingError };
      const restore: AdminUserAttributes = input.type === "perfil"
        ? { user_metadata: { full_name: previousAuth.user_metadata?.full_name ?? null } }
        : { ban_duration: until > Date.now() ? `${Math.ceil((until - Date.now()) / 1000)}s` : "none" };
      await supabase.auth.admin.updateUserById(userId, restore);
      read = await supabase.auth.admin.getUserById(userId);
      if (read.error || !read.data.user || !sameAccess(previousAuth, read.data.user, input.type)) return { ok: false, error: pendingError };
    }
    const reverted = await finish(false);
    return { ok: false, error: reverted?.estado === "revertida"
      ? "No se pudo actualizar la cuenta de acceso. Se recuperó el perfil anterior." : pendingError };
  } catch {
    return { ok: false, error: pendingError };
  }
}
