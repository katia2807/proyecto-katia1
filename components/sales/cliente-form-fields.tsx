"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/ui/field";

type ClienteFormFieldsProps = {
  /** Prefijo para los names del formulario; vacío por defecto. Útil para no chocar con otros campos. */
  prefix?: string;
  /** Valor inicial del tipo de persona. */
  defaultTipoPersona?: "natural" | "empresa" | "";
  defaultNombre?: string;
  defaultDocumento?: string;
  defaultRuc?: string;
  defaultTelefono?: string;
  defaultDireccion?: string;
  /** Marca si el bloque entero es opcional (no envía required en nombre). */
  optional?: boolean;
};

/**
 * Bloque común para datos de cliente: nombre + tipo de persona +
 * documento (DNI o RUC condicional) + dirección + teléfono.
 */
export function ClienteFormFields({
  prefix = "",
  defaultTipoPersona = "natural",
  defaultNombre = "",
  defaultDocumento = "",
  defaultRuc = "",
  defaultTelefono = "",
  defaultDireccion = "",
  optional = false,
}: ClienteFormFieldsProps) {
  const [tipo, setTipo] = useState<"natural" | "empresa" | "">(defaultTipoPersona);

  const name = (n: string) => (prefix ? `${prefix}_${n}` : n);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field
        name={name("nombre")}
        label="Nombre o razón social"
        defaultValue={defaultNombre}
        required={!optional}
      />
      <SelectField
        name={name("tipo_persona")}
        label="Tipo"
        value={tipo}
        onChange={(event) => setTipo(event.target.value as "natural" | "empresa" | "")}
      >
        <option value="natural">Persona natural</option>
        <option value="empresa">Empresa (RUC)</option>
        <option value="">Sin especificar</option>
      </SelectField>

      {tipo === "empresa" ? (
        <Field
          name={name("ruc")}
          label="RUC"
          inputMode="numeric"
          maxLength={11}
          placeholder="20XXXXXXXXX"
          defaultValue={defaultRuc}
        />
      ) : (
        <Field
          name={name("documento")}
          label="DNI / Documento"
          inputMode="numeric"
          maxLength={12}
          defaultValue={defaultDocumento}
        />
      )}

      <Field
        name={name("telefono")}
        label="Teléfono"
        inputMode="tel"
        placeholder="9XXXXXXXX"
        defaultValue={defaultTelefono}
      />
      <Field
        className="md:col-span-2"
        name={name("direccion")}
        label="Dirección"
        placeholder="Av. / Jr. / Mz. y Lt."
        defaultValue={defaultDireccion}
      />
    </div>
  );
}
