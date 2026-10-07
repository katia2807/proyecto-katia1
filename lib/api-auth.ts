import "server-only";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import type { AppRole } from "@/lib/supabase/types";
import { resolveRole } from "@/lib/permissions";

/**
 * Autenticación para Route Handlers: misma sesión que el layout (`getAuthContext`).
 * Sin sesión → 401. Con sesión pero rol no permitido → 403.
 */
export async function requireApiAuth(allowedRoles?: readonly AppRole[]) {
  const context = await getAuthContext();
  if (!context) {
    return {
      context: null,
      response: NextResponse.json({ error: "No autorizado." }, { status: 401 }),
    };
  }

  if (allowedRoles && !allowedRoles.some(role => resolveRole(role) === resolveRole(context.role, context.uiRole))) {
    return {
      context: null,
      response: NextResponse.json({ error: "No tienes permisos para esta operación." }, { status: 403 }),
    };
  }

  return { context, response: null };
}
