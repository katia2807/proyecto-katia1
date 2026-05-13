"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectBase = useMemo(
    () => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase no está configurado en este entorno.");
      setPending(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/reset-password`,
    });
    if (resetError) {
      setError(resetError.message);
      setPending(false);
      return;
    }

    setSuccess("Te enviamos un link al correo para restablecer tu contraseña");
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field
        name="email"
        type="email"
        label="Correo electrónico"
        placeholder="tu@empresa.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error ? <p className="text-sm text-[var(--accent-danger)]">{error}</p> : null}
      {success ? <p className="text-sm text-[var(--accent-success)]">{success}</p> : null}
      <Button className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar instrucciones"}
      </Button>
      <p className="text-right text-xs text-[var(--text-secondary)]">
        <Link href="/login" className="hover:text-[var(--text-primary)] hover:underline">
          Volver al login
        </Link>
      </p>
    </form>
  );
}
