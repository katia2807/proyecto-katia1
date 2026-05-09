"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth";

const COOKIE_KEY = "antifraud_access";

export async function requestAntifraudeAccess(formData: FormData) {
  await requireAuthContext({
    allowedRoles: ["owner_admin", "gerencia"],
    redirectTo: null,
  });
  const code = String(formData.get("access_code") ?? "").trim();
  const expected = process.env.ANTIFRAUD_ACCESS_CODE || "KATIA-ANTIFRAUDE";

  if (!code || code !== expected) {
    throw new Error("Permiso denegado: código de acceso inválido.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEY, "granted", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 4,
  });

  revalidatePath("/reportes/antifraude");
}

export async function revokeAntifraudeAccess() {
  await requireAuthContext({
    allowedRoles: ["owner_admin", "gerencia"],
    redirectTo: null,
  });
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEY);
  revalidatePath("/reportes/antifraude");
}
