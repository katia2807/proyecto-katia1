"use server";

import { z } from "zod";
import { getSupabaseAuthServerClient, requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/runtime";

export type AccountFormState = {
  error?: string;
  success?: string;
};

const accountSchema = z
  .object({
    email: z.string().trim().email("Ingresa un correo válido."),
    fullName: z.string().trim().min(2, "El nombre visible debe tener al menos 2 caracteres."),
    currentPassword: z.string().min(1, "Ingresa tu contraseña anterior."),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => !data.newPassword || data.newPassword.length >= 8, {
    path: ["newPassword"],
    message: "La nueva contraseña debe tener al menos 8 caracteres.",
  })
  .refine((data) => (data.newPassword ?? "") === (data.confirmPassword ?? ""), {
    path: ["confirmPassword"],
    message: "La confirmación no coincide con la nueva contraseña.",
  });

export async function updateAccountSettings(
  _prevState: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const context = await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });
  if (!hasSupabaseEnv()) return {error:"Los cambios de cuenta requieren la conexión publicada. No se modificó el acceso desde la copia local."};

  const parsed = accountSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    currentPassword: formData.get("currentPassword"),
    newPassword: String(formData.get("newPassword") ?? "").trim() || undefined,
    confirmPassword: String(formData.get("confirmPassword") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return { error: "No hay cliente de autenticación configurado." };
  }

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();
  if (userError || !user?.email) {
    return { error: "No se pudo obtener la sesión actual." };
  }

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return { error: "La contraseña anterior no es correcta." };
  }

  const nextEmail = parsed.data.email.trim().toLowerCase();
  const emailChanged = nextEmail !== user.email.toLowerCase();
  const { error: authError } = await authClient.auth.updateUser({
    ...(parsed.data.newPassword ? { password:parsed.data.newPassword } : {}),
    ...(emailChanged ? { email:nextEmail } : {}),
    data: { full_name:parsed.data.fullName },
  });
  if (authError) return { error:"No se pudo actualizar la cuenta de acceso. El nombre del perfil no se modificó." };
  const admin = getSupabaseServerClient();
  const { data: updated, error: profileError } = await admin.from("perfiles").update({full_name:parsed.data.fullName}).eq("user_id",context.userId).eq("organization_id",context.organizationId).select("id").maybeSingle();
  if (profileError || !updated) return { error:"La cuenta de acceso se actualizó, pero no se pudo guardar el nombre del perfil. Si cambiaste contraseña, usa la nueva; si cambiaste correo, revisa su confirmación. Reintenta solo el nombre." };
  return { success:emailChanged ? "Cuenta actualizada. Revisa tu correo para confirmar el cambio de dirección." : "Cuenta actualizada correctamente." };
}
