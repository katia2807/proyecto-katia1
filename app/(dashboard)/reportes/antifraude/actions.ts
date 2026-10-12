"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";
import { ANTIFRAUDE_COOKIE, ANTIFRAUDE_DURACION, crearAccesoAntifraude } from '@/lib/antifraude-acceso';

const COOKIE_KEY = ANTIFRAUDE_COOKIE;

export async function requestAntifraudeAccess(formData: FormData) {
  const context = await requireAuthContext({
    allowedRoles: ["owner_admin", "gerencia"],
    redirectTo: null,
  });
  const code = String(formData.get("access_code") ?? "").trim();
  const expected = process.env.ANTIFRAUD_ACCESS_CODE?.trim();
  if (!expected) {
    throw new Error("El acceso con código todavía no está configurado. Solicita su configuración a la persona responsable del sistema.");
  }

  if (!code || code !== expected) {
    throw new Error("Permiso denegado: código de acceso inválido.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEY, crearAccesoAntifraude(context, expected), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ANTIFRAUDE_DURACION,
  });

  revalidatePath("/reportes/antifraude");
  revalidatePath("/reportes");
}

export async function submitAntifraudeAccess(formData: FormData): Promise<{error?:string;success?:string}> {
  try { await requestAntifraudeAccess(formData);return {success:"Acceso temporal validado."}; }
  catch(error) { return {error:error instanceof Error?error.message:"No se pudo comprobar el acceso."}; }
}

export async function revokeAntifraudeAccess() {
  await requireAuthContext({
    allowedRoles: ["owner_admin", "gerencia"],
    redirectTo: null,
  });
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEY);
  revalidatePath("/reportes/antifraude");
  revalidatePath("/reportes");
}
