"use server";

import { z } from "zod";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getSupabaseAuthServerClient, requireAuthContext } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
  await requireAuthContext({ allowedRoles: ["owner_admin"], redirectTo: null });

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

  const admin = getSupabaseServerClient();
  const { error: profileError } = await admin
    .from("perfiles")
    .update({ full_name: parsed.data.fullName })
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID);
  if (profileError) {
    return { error: profileError.message };
  }

  if (parsed.data.newPassword) {
    const { error: pwError } = await authClient.auth.updateUser({
      password: parsed.data.newPassword,
    });
    if (pwError) {
      return { error: pwError.message };
    }
  }

  const nextEmail = parsed.data.email.trim().toLowerCase();
  if (nextEmail !== user.email?.toLowerCase()) {
    const { error: emailError } = await authClient.auth.updateUser({ email: nextEmail });
    if (emailError) {
      return { error: emailError.message };
    }
    return {
      success:
        "Datos actualizados. Si cambiaste el correo, revisa tu bandeja para confirmarlo según la configuración de Supabase.",
    };
  }

  return { success: "Cuenta actualizada correctamente." };
}
