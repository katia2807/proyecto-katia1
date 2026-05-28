"use client";

import { useActionState } from "react";
import {
  updateEmpresaConfig,
  type EmpresaFormState,
} from "@/app/(dashboard)/admin/empresa/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { EmpresaConfig } from "@/lib/company-config";

const initialState: EmpresaFormState = {};

type EmpresaSettingsFormProps = {
  empresa: EmpresaConfig;
};

export function EmpresaSettingsForm({ empresa }: EmpresaSettingsFormProps) {
  const [state, action, pending] = useActionState(updateEmpresaConfig, initialState);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field name="nombre" label="Nombre de empresa" defaultValue={empresa.nombre} required />
      <Field name="ruc" label="RUC" defaultValue={empresa.ruc} required />
      <Field name="telefono" label="Telefono" defaultValue={empresa.telefono} required />
      <Field name="firmante" label="Firmante" defaultValue={empresa.firmante} required />
      <Field name="firmante_cargo" label="Cargo del firmante" defaultValue={empresa.firmante_cargo} required />
      <Field
        className="md:col-span-2"
        name="direccion"
        label="Direccion"
        defaultValue={empresa.direccion}
        required
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
