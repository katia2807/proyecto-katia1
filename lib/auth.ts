import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";

/** Cookie antigua del login local; se borra en logout por si quedó en el navegador. */
export const LEGACY_LOCAL_AUTH_COOKIE = "katia_local_auth";

export type AuthContext = {
  userId: string;
  organizationId: string;
  role: AppRole;
  /** Rol funcional en la app (`owner_admin` | `operaciones` | `readonly`); null = usuario legado sin migración UI. */
  uiRole: "owner_admin" | "operaciones" | "readonly" | null;
  fullName: string | null;
  email: string | null;
};

type AccessOptions = {
  allowedRoles?: readonly AppRole[];
  redirectTo?: string | null;
};

export const WRITER_ROLES: readonly AppRole[] = ["owner_admin", "gerencia", "operaciones_caja", "ventas", "rrhh"];

export async function getSupabaseAuthServerClient() {
  const { url, anonKey } = getServerSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions);
          });
        } catch {
          // During certain renders, cookie mutations are not available.
        }
      },
    },
  });
}

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const authClient = await getSupabaseAuthServerClient();
  if (!authClient) {
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();
  if (userError || !user) {
    return null;
  }

  const adminClient = getSupabaseServerClient();
  const { data: profile, error: profileError } = await adminClient
    .from("perfiles")
    .select("user_id,organization_id,role,full_name,ui_role,deactivated_at")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (profileError || !profile?.role) {
    return null;
  }

  if (profile.deactivated_at) {
    return null;
  }

  const uiRoleRaw = profile.ui_role;
  const uiRole =
    uiRoleRaw === "owner_admin" || uiRoleRaw === "operaciones" || uiRoleRaw === "readonly"
      ? uiRoleRaw
      : null;

  return {
    userId: profile.user_id,
    organizationId: profile.organization_id,
    role: profile.role,
    uiRole,
    fullName: profile.full_name,
    email: user.email ?? null,
  };
});

export async function requireAuthContext(options: AccessOptions = {}) {
  const context = await getAuthContext();
  const redirectTo = options.redirectTo ?? "/login";

  if (!context) {
    if (redirectTo) {
      redirect(redirectTo);
    }
    throw new Error("Acceso denegado: sesión inválida.");
  }

  const { allowedRoles } = options;
  if (allowedRoles && !allowedRoles.includes(context.role)) {
    throw new Error("Acceso denegado: no tienes permisos para esta acción.");
  }

  return context;
}
