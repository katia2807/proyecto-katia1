"use client";

import { useActionState } from "react";
import { loginWithPassword, type LoginFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginWithPassword, initialState);

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field name="email" type="email" label="Correo electrónico" placeholder="tu@empresa.com" required />
      <Field name="password" type="password" label="Contraseña" required />
      {state.error ? <p className="text-sm text-[var(--color-danger)]">{state.error}</p> : null}
      <Button className="w-full" disabled={pending}>
        {pending ? "Validando..." : "Ingresar al panel"}
      </Button>
    </form>
  );
}
