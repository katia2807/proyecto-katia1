"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { AppRole } from "@/lib/supabase/types";
import { canAccessPath } from "@/lib/permissions";

type AppShellAccessGuardProps = {
  pathname: string;
  userRole: AppRole;
  uiRole: "owner_admin" | "operaciones" | "readonly" | null;
};

/**
 * Next.js exige un `<Suspense>` alrededor de componentes que usan `useSearchParams`
 * para no romper el pipeline de RSC/prerender. Mantener este hook aislado aquí.
 */
export function AppShellAccessGuard({ pathname, userRole, uiRole }: AppShellAccessGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mensaje = searchParams.get("mensaje");
    const canAccess = canAccessPath(userRole, uiRole, pathname);
    if (!canAccess && !(pathname === "/" && mensaje === "no-acceso")) {
      router.replace("/?mensaje=no-acceso");
    }
  }, [pathname, router, searchParams, uiRole, userRole]);

  return null;
}
