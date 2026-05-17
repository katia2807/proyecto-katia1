import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth";
import { isDemoDatabaseMode } from "@/lib/demo-mode";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getServerSupabaseCredentials } from "@/lib/supabase/temp-credentials";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ aviso?: string | string[]; mensaje?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = (await searchParams) ?? {};
  const avisoPanel = String(sp.aviso ?? "") === "panel";
  const passwordUpdated = String(sp.mensaje ?? "") === "password-updated";

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
    <AuthSplitLayout
      title="Ingreso privado"
      subtitle={
        showLocalDemoHint
          ? "Modo prueba local: los datos vienen del almacén demo (no Supabase)."
          : "Acceso seguro al panel de gestión del taller."
      }
    >
      {passwordUpdated ? (
        <div className="mt-4 rounded-[var(--border-radius-input)] border border-emerald-500/50 bg-emerald-900/40 p-3 text-sm text-white">
          Contraseña actualizada.
        </div>
      ) : null}

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
        <div className="mt-4 rounded-[var(--border-radius-input)] border border-amber-500/40 bg-amber-900/20 p-3 text-sm text-[var(--text-primary)]">
          <p className="font-semibold text-amber-400">Sesión expirada</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            Tu sesión cerró automáticamente por inactividad. Vuelve a ingresar con tus datos.
          </p>
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
      <p className="mt-3 text-right text-xs text-[var(--text-secondary)]/90">
        <Link href="/forgot-password" className="hover:text-[var(--text-primary)] hover:underline">
          Olvidé mi contraseña
        </Link>
      </p>
      <p className="mt-4 text-xs text-[var(--text-secondary)]">
        {showLocalDemoHint
          ? "En producción desactiva modo demo y configura Supabase real."
          : "El usuario debe tener perfil válido en la organización."}
      </p>
    </AuthSplitLayout>
  );
}
