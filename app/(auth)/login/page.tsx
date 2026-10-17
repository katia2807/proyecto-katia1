import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginLayout } from "@/components/auth/login-layout";
import styles from "@/components/auth/login-layout.module.css";
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
    <LoginLayout>
      {passwordUpdated ? (
        <div role="status" className={[styles.notice, styles.success].join(" ")}>
          <strong>Contraseña actualizada.</strong>
        </div>
      ) : null}
      {avisoPanel ? (
        <div role="status" className={[styles.notice, styles.warning].join(" ")}>
          <strong>Sesión expirada</strong>
          <p>Vuelve a ingresar con tus datos para continuar.</p>
        </div>
      ) : null}
      {showSupabasePublicKeysMissing ? (
        <div role="alert" className={[styles.notice, styles.danger].join(" ")}>
          <strong>Supabase no configurado</strong>
          <p>Define credenciales públicas/servidor y redeploy.</p>
        </div>
      ) : null}
      <LoginForm />
      <p className={styles.recovery}>
        <Link href="/forgot-password">Olvidé mi contraseña</Link>
      </p>
      {showLocalDemoHint ? (
        <details className={styles.demo}>
          <summary>Acceso de prueba local</summary>
          <p>Este entorno utiliza datos ficticios.</p>
          <div className={styles.credentials}>
            <span>Correo: <code>test@test.com</code></span>
            <span>Contraseña: <code>test1234</code></span>
          </div>
        </details>
      ) : null}
    </LoginLayout>
  );
}
