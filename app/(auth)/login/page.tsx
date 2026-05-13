import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth";
import { DEFAULT_ORG_ID } from "@/lib/constants";
import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ aviso?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = (await searchParams) ?? {};
  const avisoPanel = String(sp.aviso ?? "") === "panel";

  let context = null;
  try {
    context = await getAuthContext();
  } catch {
    context = null;
  }
  if (context) {
    redirect("/");
  }

  const { url: supabaseUrl, anonKey: supabaseAnon } = getServerSupabaseCredentials();
  const showSupabasePublicKeysMissing =
    !isDemoDatabaseMode() && (!supabaseUrl?.trim() || !supabaseAnon?.trim());

  const showLocalDemoHint =
    isDemoDatabaseMode() || (process.env.NODE_ENV === "development" && !hasSupabaseEnv());

  return (
    <main className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <section className="flex items-center justify-center bg-[var(--bg-primary)] px-6 py-10">
        <div className="w-full max-w-md rounded-[var(--border-radius-card)] border border-[var(--border-color)] bg-[var(--bg-surface)] p-7 shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">ERP KATIA</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">Ingreso privado</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {showLocalDemoHint
              ? "Modo prueba local: los datos vienen del almacén demo (no Supabase)."
              : "Acceso seguro al panel de gestión del taller."}
          </p>

          {showLocalDemoHint ? (
            <div className="mt-4 rounded-[var(--border-radius-input)] border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-primary)]">
              <p className="font-semibold">Credenciales de prueba</p>
              <p className="mt-1 font-mono text-xs">
                Correo: test@test.com
                <br />
                Contraseña: test1234
              </p>
              {isDemoDatabaseMode() ? (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  Activo por <code className="rounded bg-[var(--bg-primary)] px-1">KATIA_USE_DEMO_DB=1</code>.
                </p>
              ) : null}
            </div>
          ) : null}

          {avisoPanel ? (
            <div className="mt-4 rounded-[var(--border-radius-input)] border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-primary)]">
              <p className="font-semibold">No se abrió el panel</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                Sesión válida, pero no existe tu fila en <code className="rounded bg-[var(--bg-primary)] px-1">public.perfiles</code> para:
              </p>
              <p className="mt-2 break-all font-mono text-xs text-[var(--text-primary)]">{DEFAULT_ORG_ID}</p>
            </div>
          ) : null}

          {showSupabasePublicKeysMissing ? (
            <div className="mt-4 rounded-[var(--border-radius-input)] border border-[var(--accent-danger)]/55 bg-[var(--bg-card)] p-3 text-sm">
              <p className="font-semibold text-[var(--accent-danger)]">Supabase no configurado</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                Define credenciales públicas/servidor y redeploy.
              </p>
            </div>
          ) : null}

          <LoginForm />
          <p className="mt-3 text-right text-xs text-[var(--text-secondary)]/90">Olvidé mi contraseña</p>
          <p className="mt-4 text-xs text-[var(--text-secondary)]">
            {showLocalDemoHint
              ? "En producción desactiva modo demo y configura Supabase real."
              : "El usuario debe tener perfil válido en la organización."}
          </p>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[var(--bg-sidebar)] md:block">
        <div className="login-sphere left-[12%] top-[14%] h-44 w-44 bg-[var(--accent-primary)]/45" />
        <div className="login-sphere right-[16%] top-[20%] h-64 w-64 bg-[var(--accent-secondary)]/35 [animation-delay:0.7s]" />
        <div className="login-sphere bottom-[15%] left-[20%] h-56 w-56 bg-[var(--accent-primary)]/35 [animation-delay:1.4s]" />
        <div className="login-sphere bottom-[8%] right-[10%] h-40 w-40 bg-[var(--accent-secondary)]/40 [animation-delay:2.1s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.12),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(6,182,212,0.14),transparent_50%)]" />
      </section>
    </main>
  );
}
