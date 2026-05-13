import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth";
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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">ERP Katia</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">Ingreso privado</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {showLocalDemoHint
            ? "Modo prueba local: los datos vienen del almacén demo (no Supabase). No uses credenciales reales."
            : "Acceso solo para usuarios autorizados. Usa el correo y la contraseña del usuario registrado en Supabase Auth."}
        </p>

        {showLocalDemoHint ? (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-text-primary)]">
            <p className="font-semibold">Credenciales de prueba</p>
            <p className="mt-1 font-mono text-xs">
              Correo: test@test.com
              <br />
              Contraseña: test1234
            </p>
            {isDemoDatabaseMode() ? (
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Activo porque <code className="rounded bg-[var(--color-surface)] px-1">KATIA_USE_DEMO_DB=1</code> está
                definido (revisa <code className="rounded bg-[var(--color-surface)] px-1">.env.local</code> o el
                archivo de ejemplo en la raíz del repo).
              </p>
            ) : null}
          </div>
        ) : null}

        {avisoPanel ? (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-text-primary)]">
            <p className="font-semibold">No se abrió el panel</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              La sesión de Supabase puede ser válida pero falta acceso al perfil. Revisa en Supabase: una fila en{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">perfiles</code> con tu{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">user_id</code> y la organización de la app (
              <code className="rounded bg-[var(--color-surface)] px-1">ERP_ORG_ID</code> / valor por defecto del
              código). Si acabas de aplicar migraciones, incluye la política{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">perfiles_select_self</code> (última migración
              del repo). En Vercel, variables distintas por <strong>proyecto</strong> y por entorno: marca{" "}
              <strong>Production</strong> y <strong>Preview</strong> si usas URLs de preview.
            </p>
          </div>
        ) : null}

        {showSupabasePublicKeysMissing ? (
          <div className="mt-4 rounded-xl border border-[var(--color-danger)] bg-[var(--color-primary-soft)] p-3 text-sm">
            <p className="font-semibold text-[var(--color-danger)]">Supabase no está configurado en este servidor</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              Opción A:{" "}
              <code className="rounded bg-[var(--color-surface)] px-1 text-[var(--color-text-primary)]">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              y{" "}
              <code className="rounded bg-[var(--color-surface)] px-1 text-[var(--color-text-primary)]">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>
              . Opción B (solo servidor, a veces más fiable en Vercel):{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">SUPABASE_URL</code> y{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">SUPABASE_ANON_KEY</code> (mismos valores que en
              el panel de Supabase: Project URL y anon public). En <strong>Vercel</strong>: el{" "}
              <strong>mismo proyecto</strong> que despliega esta URL → <strong>Settings</strong> →{" "}
              <strong>Environment Variables</strong> → marca <strong>Production</strong> y{" "}
              <strong>Preview</strong> → guarda → <strong>Redeploy</strong>. Comprueba{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">/api/health</code> en esta misma URL:{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">supabaseAuthReady</code> debe ser{" "}
              <code className="rounded bg-[var(--color-surface)] px-1">true</code>.
            </p>
          </div>
        ) : null}

        <LoginForm />

        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          {showLocalDemoHint
            ? "En producción desactiva el modo demo y configura Supabase con usuarios y perfiles reales."
            : "El usuario debe tener una fila en la tabla perfiles con rol adecuado para esta organización."}
        </p>
      </div>
    </main>
  );
}
