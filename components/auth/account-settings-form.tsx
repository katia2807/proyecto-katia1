"use client";

import { useActionState } from "react";
import { updateAccountSettings, type AccountFormState } from "@/app/(dashboard)/cuenta/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type AccountSettingsFormProps = {
  email: string;
  fullName: string;
};

const initialState: AccountFormState = {};

export function AccountSettingsForm({ email, fullName }: AccountSettingsFormProps) {
  const [state, action, pending] = useActionState(updateAccountSettings, initialState);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field
        name="email"
        type="email"
        label="Correo de ingreso"
        defaultValue={email}
        autoComplete="email"
        required
      />
      <Field
        name="fullName"
        label="Nombre visible"
        defaultValue={fullName}
        autoComplete="name"
        required
      />
      <Field
        name="currentPassword"
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        className="md:col-span-2"
        required
      />
      <Field
        name="newPassword"
        label="Nueva contraseña (opcional)"
        type="password"
        autoComplete="new-password"
        minLength={8}
      />
      <Field
        name="confirmPassword"
        label="Confirmar nueva contraseña"
        type="password"
        autoComplete="new-password"
        minLength={8}
      />

      {state.error ? (
        <p className="md:col-span-2 rounded-xl border border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] px-3 py-2 text-sm text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="md:col-span-2 rounded-xl border border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] px-3 py-2 text-sm text-[var(--color-success)]">
          {state.success}
        </p>
      ) : null}

      <div className="md:col-span-2">
        <Button disabled={pending}>{pending ? "Guardando..." : "Guardar cambios"}</Button>
      </div>
    </form>
  );
}
