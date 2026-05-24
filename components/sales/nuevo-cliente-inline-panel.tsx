"use client";

import { createCliente } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { useState, useRef } from "react";

/**
 * Mini formulario reutilizable para crear un cliente sin salir del panel de venta.
 * Usado en MaderaCortadaForm, AserraderoForm, ContratoAlquilerForm, etc.
 */
export function NuevoClienteInlinePanel({
  onCreated,
  onCancel,
  temporal = false,
}: {
  onCreated: (id: string, nombre: string, documento?: string, ruc?: string) => void;
  onCancel: () => void;
  temporal?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    const inputs = containerRef.current.querySelectorAll("input, select");
    
    inputs.forEach((el) => {
      const input = el as HTMLInputElement | HTMLSelectElement;
      if (input.name) {
        formData.append(input.name, input.value);
      }
    });

    const nombre = formData.get("nombre") as string;
    if (!nombre || nombre.trim().length < 3) {
      setError("El nombre es requerido y debe tener al menos 3 caracteres.");
      setLoading(false);
      return;
    }

    if (temporal) formData.set("es_temporal", "true");
    formData.set("skip_redirect", "true");

    try {
      const result = await createCliente(formData);
      if (result && typeof result === "object" && "id" in result) {
        const docVal = formData.get("documento") as string || "";
        const rucVal = formData.get("ruc") as string || "";
        onCreated(
          result.id as string,
          (result as { nombre?: string }).nombre ?? nombre,
          docVal,
          rucVal
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    }
  };

  return (
    <div 
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
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
      <div className="grid gap-3 sm:grid-cols-2">
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
          <Button type="button" size="sm" disabled={loading} onClick={handleSave}>
            {loading ? "Guardando…" : "Guardar cliente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
