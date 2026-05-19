"use client";

import { useState } from "react";
import { createProveedor } from "@/app/actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function RegistrarProveedorInline() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await createProveedor(formData);
      setOpen(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
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
        + Registrar proveedor
      </button>
    );
  }

  return (
    <div className="w-full mt-4 rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-[var(--katia-text-primary)]">Nuevo proveedor</p>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-primary)]">Cancelar</button>
      </div>
      <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field name="nombre" label="Nombre / Razón social *" placeholder="Proveedor de madera SAC" required className="sm:col-span-2" />
        <Field name="documento" label="RUC / DNI" placeholder="20123456789" />
        <Field name="telefono" label="Teléfono" placeholder="999 000 000" />
        {error && <p className="sm:col-span-2 text-xs text-red-500">{error}</p>}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError(null); }}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading ? "Guardando…" : "Guardar proveedor"}</Button>
        </div>
      </form>
    </div>
  );
}
