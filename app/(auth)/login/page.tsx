import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthContext } from "@/lib/auth";

export default async function LoginPage() {
  const context = await getAuthContext();
  if (context) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">ERP Katia</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">Ingreso privado</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Acceso solo para usuarios autorizados. Usa el correo y la contraseña del usuario registrado en Supabase Auth.
        </p>

        <LoginForm />

        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          El usuario debe tener una fila en la tabla <code>perfiles</code> con rol adecuado para esta organización.
        </p>
      </div>
    </main>
  );
}
