"use client";

import { useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { MOCK_CLIENTES_COMPLETO, type ClienteCompleto } from "@/lib/combobox-mocks";
import { cn } from "@/lib/utils";

export type { ClienteCompleto };

export type ClienteComboboxProps = {
  clientes: ClienteCompleto[];
  mockData?: boolean;
  value: string;
  onChange: (id: string) => void;
  /** Rellena nombre, documento/RUC, teléfono y dirección en el formulario contenedor */
  onSelectFull?: (cliente: ClienteCompleto) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hiddenInputName?: string;
  inputAriaLabel?: string;
  label?: string;
};

function formatSublabel(c: ClienteCompleto) {
  const doc = c.ruc ? `RUC ${c.ruc}` : c.documento ? `DNI ${c.documento}` : "";
  const parts = [doc, c.telefono ?? ""].filter(Boolean);
  return parts.join(" · ");
}

export function ClienteCombobox({
  clientes,
  mockData,
  value,
  onChange,
  onSelectFull,
  placeholder = "Buscar cliente o elegir de la lista…",
  disabled,
  className,
  hiddenInputName,
  inputAriaLabel = "Buscar cliente",
  label,
}: ClienteComboboxProps) {
  const source = mockData ? MOCK_CLIENTES_COMPLETO : clientes;

  const options: ComboboxOption[] = useMemo(
    () =>
      source.map((c) => ({
        value: c.id,
        label: c.nombre,
        sublabel: formatSublabel(c) || undefined,
      })),
    [source],
  );

  const byId = useMemo(() => {
    const m: Record<string, ClienteCompleto> = {};
    for (const c of source) m[c.id] = c;
    return m;
  }, [source]);

  return (
    <label className={cn("flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]", className)}>
      {label ? <span>{label}</span> : null}
      <Combobox
        options={options}
        value={value}
        onChange={(id) => {
          onChange(id);
          if (id && onSelectFull) {
            const c = byId[id];
            if (c) onSelectFull(c);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        hiddenInputName={hiddenInputName}
        inputAriaLabel={inputAriaLabel}
      />
    </label>
  );
}
