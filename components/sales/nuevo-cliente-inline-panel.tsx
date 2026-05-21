"use client";

import { createCliente } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { useState } from "react";

/**
 * Mini formulario reutilizable para crear un cliente sin salir del panel de venta.
 * Usado en MaderaCortadaForm, AserraderoForm, ContratoAlquilerForm, etc.
 */
export function NuevoClienteInlinePanel({
  onCreated,
  onCancel,
  temporal = false,
}: {
  onCreated: (id: string, nombre: string) => void;
  onCancel: () => void;
  temporal?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    if (temporal) formData.set("es_temporal", "true");
    try {
      const result = await createCliente(formData);
      if (result && typeof result === "object" && "id" in result) {
        onCreated(
          result.id as string,
          (result as { nombre?: string }).nombre ??
            (formData.get("nombre") as string),
        );
      } else {
        onCancel();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {temporal ? "Cliente temporal" : "Nuevo cliente"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Cancelar
        </button>
      </div>
      {temporal && (
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Se guarda como cliente normal pero marcado como &ldquo;temporal&rdquo; para diferenciarlo en reportes.
        </p>
      )}
      <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field
          name="nombre"
          label="Nombre *"
          placeholder={temporal ? "Ej: Cliente mostrador" : "Nombre completo o razón social"}
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
          <p className="sm:col-span-2 text-xs text-red-500">{error}</p>
        ) : null}
        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
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
