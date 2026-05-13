"use client";

import { useEffect, useActionState, useState } from "react";
import {
  createOrganizationUserForm,
  setOrganizationUserActiveForm,
  updateOrganizationUserForm,
  type OrgUserRow,
  type OrgUsersFormState,
} from "@/app/(dashboard)/admin/usuarios/actions";
import type { AssignableRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const initialFormState: OrgUsersFormState = { error: null };

function roleLabel(slug: AssignableRole): string {
  switch (slug) {
    case "owner_admin":
      return "Dueña (total)";
    case "gerencia":
      return "Gerencia";
    case "vendedor":
      return "Vendedor (solo lectura)";
    case "almacen":
      return "Almacén";
    case "caja":
      return "Caja";
    default:
      return slug;
  }
}

export function InviteOrganizationUserForm() {
  const { showToast } = useToast();
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(createOrganizationUserForm, initialFormState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      setFormKey((k) => k + 1);
    }
  }, [state.success, state.message, showToast]);

  return (
    <form key={formKey} action={action} className="mt-4 grid gap-3 md:grid-cols-2">
      <Field name="full_name" label="Nombre completo" required placeholder="Nombre y apellido" />
      <Field
        name="email"
        label="Correo"
        type="email"
        required
        autoComplete="email"
        placeholder="correo@ejemplo.com"
      />
      <SelectField name="role" label="Rol" required defaultValue="vendedor">
        <option value="gerencia">{roleLabel("gerencia")}</option>
        <option value="vendedor">{roleLabel("vendedor")}</option>
        <option value="almacen">{roleLabel("almacen")}</option>
        <option value="caja">{roleLabel("caja")}</option>
      </SelectField>
      <div className="flex flex-col gap-2 md:col-span-2">
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
            {state.error}
          </p>
        ) : null}
        <div className="flex items-end">
          <Button type="submit" className="w-full md:w-auto" disabled={pending}>
            {pending ? "Enviando…" : "Enviar invitación"}
          </Button>
        </div>
      </div>
    </form>
  );
}

type UpdateUserFormProps = {
  row: OrgUserRow;
  effectiveRole: AssignableRole;
};

export function UpdateOrganizationUserForm({ row, effectiveRole }: UpdateUserFormProps) {
  const [state, action, pending] = useActionState(updateOrganizationUserForm, initialFormState);

  return (
    <form action={action} className="grid max-w-lg gap-3 sm:grid-cols-2 sm:items-end">
      <input type="hidden" name="user_id" value={row.user_id} />
      <Field name="full_name" label="Nombre" defaultValue={row.full_name ?? ""} required />
      <SelectField name="role" label="Rol" defaultValue={effectiveRole}>
        <option value="owner_admin">{roleLabel("owner_admin")}</option>
        <option value="gerencia">{roleLabel("gerencia")}</option>
        <option value="vendedor">{roleLabel("vendedor")}</option>
        <option value="almacen">{roleLabel("almacen")}</option>
        <option value="caja">{roleLabel("caja")}</option>
      </SelectField>
      <div className="flex flex-col gap-1 sm:col-span-2">
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

type SetActiveFormProps = {
  userId: string;
  active: boolean;
  label: string;
  variant: "secondary" | "danger";
};

export function SetOrganizationUserActiveFormClient({ userId, active, label, variant }: SetActiveFormProps) {
  const [state, action, pending] = useActionState(setOrganizationUserActiveForm, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="active" value={active ? "true" : "false"} />
      <Button type="submit" variant={variant} className="!h-9 !px-3 !text-xs" disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {state.error ? (
        <p role="alert" className="max-w-[14rem] text-xs font-medium text-[var(--color-danger)]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
