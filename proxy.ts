import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware de renovación de sesión de Supabase.
 *
 * Sin este archivo el access token (1 h) expira y el servidor no puede
 * refrescarlo porque no hay lugar donde escribir las cookies actualizadas.
 * El resultado es que el usuario queda "logueado" en el navegador pero el
 * servidor lo rechaza → pantalla de "No se abrió el panel".
 */
export async function proxy(request: NextRequest) {
  // Leer credenciales públicas (disponibles en Edge y Node)
  const supabaseUrl =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ??
    process.env["SUPABASE_URL"] ??
    "";
  const supabaseAnonKey =
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ??
    process.env["SUPABASE_ANON_KEY"] ??
    "";

  // Si Supabase no está configurado, dejar pasar sin tocar nada
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Primero actualizar las cookies en el request (para que Server Components las lean)
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        // Luego recrear la respuesta con las cookies actualizadas
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: llamar getUser() aquí es lo que dispara el refresco del token.
  // No usar getSession() — puede devolver datos sin verificar.
  await supabase.auth.getUser();

  return response;
}

// Aplicar middleware a todas las rutas excepto assets estáticos y API de health
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
