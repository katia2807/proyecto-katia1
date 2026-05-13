"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("La confirmación no coincide.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase no está configurado en este entorno.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }
    router.replace("/login?mensaje=password-updated");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field
        name="new_password"
        type="password"
        label="Nueva contraseña"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        name="confirm_password"
        type="password"
        label="Confirmar contraseña"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      {error ? <p className="text-sm text-[var(--accent-danger)]">{error}</p> : null}
      <Button className="w-full" disabled={pending}>
        {pending ? "Actualizando..." : "Actualizar contraseña"}
      </Button>
      <p className="text-right text-xs text-[var(--text-secondary)]">
        <Link href="/login" className="hover:text-[var(--text-primary)] hover:underline">
          Volver al login
        </Link>
      </p>
    </form>
  );
}
