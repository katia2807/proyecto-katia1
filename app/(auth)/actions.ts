"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LEGACY_LOCAL_AUTH_COOKIE, getSupabaseAuthServerClient } from "@/lib/auth";
import { isDemoDatabaseMode } from "@/lib/demo-mode";

export type LoginFormState = {
  error?: string;
};

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(6),
});
const DEV_LOGIN_EMAIL = "test@test.com";
const DEV_LOGIN_PASSWORD = "test1234";
const DEV_LOGIN_COOKIE_VALUE = "dev-local-owner-admin";

export async function loginWithPassword(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Credenciales inválidas. Revisa correo y contraseña." };
  }

  const email = parsed.data.email.trim();
  if (!email.includes("@")) {
    return { error: "Usa un correo electrónico válido para iniciar sesión." };
  }

  const allowLocalDemoLogin = process.env.NODE_ENV === "development" || isDemoDatabaseMode();
  if (allowLocalDemoLogin) {
    const password = parsed.data.password;
    if (email.toLowerCase() === DEV_LOGIN_EMAIL && password === DEV_LOGIN_PASSWORD) {
      const cookieStore = await cookies();
      cookieStore.set(LEGACY_LOCAL_AUTH_COOKIE, DEV_LOGIN_COOKIE_VALUE, {
        path: "/",
        sameSite: "lax",
        httpOnly: true,
      });
      redirect("/");
    }
  }

  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    if (isDemoDatabaseMode()) {
      return {
        error:
          "Modo demo activo (KATIA_USE_DEMO_DB): inicia con test@test.com y la contraseña de prueba indicada en la pantalla de login.",
      };
    }
    const hint =
      process.env.VERCEL || process.env.NODE_ENV === "production"
        ? " En Vercel: Settings → Environment Variables (Production y Preview), guarda y Redeploy."
        : " En local: crea o edita `.env.local` en la raíz del repo.";
    return {
      error: `[Katia] Faltan credenciales Supabase (URL + anon). En Vercel: SUPABASE_URL + SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY en este proyecto, Production+Preview, luego Redeploy. Comprueba /api/health.${hint}`,
    };
  }

  const { error } = await authClient.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "No se pudo iniciar sesión. Verifica tus credenciales." };
  }

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(LEGACY_LOCAL_AUTH_COOKIE);

  const authClient = await getSupabaseAuthServerClient();
  if (authClient) {
    await authClient.auth.signOut();
  }

  redirect("/login");
}
