import { getAuthContext } from "@/lib/auth";
import type { AppRole } from "@/lib/supabase/types";

export type DashboardSession = {
  role: AppRole;
  uiRole: "owner_admin" | "operaciones" | "readonly" | null;
};

/** Sesión con rol enum + rol UI (si existe). Preferido para comprobaciones con `lib/permissions`. */
export async function getDashboardSession(): Promise<DashboardSession | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  return { role: ctx.role, uiRole: ctx.uiRole };
}

/** Solo el rol enum de Supabase (compatibilidad). */
export async function getCurrentUserRole(): Promise<AppRole | null> {
  const s = await getDashboardSession();
  return s?.role ?? null;
}
