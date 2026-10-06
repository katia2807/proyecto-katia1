"use client";

import { useState } from "react";
import { submitCreateClienteForm } from "@/app/actions";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function NuevoClienteInline() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await submitCreateClienteForm(mutationFormInitialState, formData);
      if (result.success) setOpen(false);
      else setError(result.error ?? "No se pudo registrar el cliente.");
    } catch {
      setError("No se pudo registrar el cliente. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        + Nuevo cliente
      </button>
    );
  }

  return (
    <div className="w-full rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--katia-text-primary)]">Agregar cliente</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="text-xs text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-primary)]"
        >
          Cancelar
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) void handleSubmit(new FormData(event.currentTarget));
        }}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <Field
          name="nombre"
          label="Nombre *"
          placeholder="Nombre completo o razón social"
          required
          className="sm:col-span-2"
        />
        <Field name="documento" label="DNI / Documento" placeholder="12345678" />
        <Field name="telefono" label="Teléfono" placeholder="999 000 000" />
        <Field name="ruc" label="RUC (opcional)" placeholder="20123456789" />
        <Field name="direccion" label="Dirección (opcional)" placeholder="Av. / Jr. / Referencia" />
        <SelectField name="tipo_persona" label="Tipo" defaultValue="">
          <option value="">Sin especificar</option>
          <option value="natural">Persona natural</option>
          <option value="empresa">Empresa</option>
        </SelectField>

        {error ? (
          <p role="alert" className="sm:col-span-2 text-xs text-[var(--katia-danger)]">{error}</p>
        ) : null}

        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Guardando…" : "Guardar cliente"}
          </Button>
        </div>
      </form>
    </div>
  );
}
