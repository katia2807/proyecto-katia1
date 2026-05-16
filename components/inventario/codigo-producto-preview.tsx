"use client";

import { useState } from "react";
import { IconSparkles, IconPencil } from "@tabler/icons-react";
import { previsualizarCodigo } from "@/lib/codigo-producto";
import { cn } from "@/lib/utils";

type CodigoProductoPreviewProps = {
  /** Nombre del field de nombre en el form (para vincular onChange) */
  nombreFieldName?: string;
  codigoFieldName?: string;
  defaultCodigo?: string;
};

export function CodigoProductoPreview({
  codigoFieldName = "codigo",
  defaultCodigo = "",
}: CodigoProductoPreviewProps) {
  const [nombre, setNombre] = useState("");
  const [codigoManual, setCodigoManual] = useState(defaultCodigo);
  const [modoManual, setModoManual] = useState(Boolean(defaultCodigo));

  const sugerido = previsualizarCodigo(nombre);

  return (
    <div className="md:col-span-2 space-y-3">
      {/* Campo nombre con listener */}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--katia-text-primary)] mb-1.5">
            Nombre <span aria-hidden className="text-[var(--katia-danger)]">*</span>
          </label>
          <input
            name="nombre"
            required
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (!modoManual) setCodigoManual("");
            }}
            placeholder="Ej. Madera Roble 2x10x240"
            className="h-10 w-full rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)] px-3 text-sm text-[var(--katia-text-primary)] placeholder:text-[var(--katia-text-disabled)] focus:border-[var(--katia-border-emphasis)] focus:outline-none focus:shadow-[var(--katia-shadow-focus)]"
          />
        </div>

        {/* Campo código: sugerido o manual */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[var(--katia-text-primary)]">
              Código <span aria-hidden className="text-[var(--katia-danger)]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setModoManual((m) => !m)}
              className="flex items-center gap-1 text-xs text-[var(--katia-primary)] hover:underline"
            >
              <IconPencil className="size-3" />
              {modoManual ? "Usar sugerido" : "Editar"}
            </button>
          </div>
          <div className="relative">
            <input
              name={codigoFieldName}
              required
              readOnly={!modoManual}
              value={modoManual ? codigoManual : (sugerido?.replace("###", "001") ?? "")}
              onChange={(e) => modoManual && setCodigoManual(e.target.value)}
              placeholder={modoManual ? "MAD-ROB-2605-001" : "Escribe el nombre para sugerir…"}
              className={cn(
                "h-10 w-full rounded-[var(--katia-radius-md)] border px-3 pr-9 font-mono text-sm",
                "text-[var(--katia-text-primary)] placeholder:text-[var(--katia-text-disabled)]",
                "focus:outline-none focus:shadow-[var(--katia-shadow-focus)]",
                modoManual
                  ? "border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)] focus:border-[var(--katia-border-emphasis)]"
                  : "border-[var(--katia-primary)]/30 bg-[var(--katia-primary-soft)] cursor-default",
              )}
            />
            {!modoManual && sugerido ? (
              <IconSparkles className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--katia-primary)]" />
            ) : null}
          </div>
          {!modoManual && sugerido ? (
            <p className="mt-1 text-xs text-[var(--katia-text-tertiary)]">
              Código sugerido automáticamente · ### = secuencia al guardar
            </p>
          ) : !modoManual && nombre.trim() ? (
            <p className="mt-1 text-xs text-[var(--katia-text-tertiary)]">
              Escribe más para sugerir código…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
