"use client";

import { useMemo, useState } from "react";
import { plantillasNotas, renderPlantilla } from "@/lib/plantillas-notas";

type NotasSelectorProps = {
  /** Nombre del campo oculto donde se guardan las notas resueltas (separadas por salto de línea). */
  name?: string;
  /** Etiqueta visible para el bloque. */
  label?: string;
  /** Texto adicional libre que se añade al final si el usuario lo escribe. */
  defaultExtra?: string;
};

export function NotasSelector({
  name = "observaciones",
  label = "Notas y observaciones",
  defaultExtra = "",
}: NotasSelectorProps) {
  const [seleccionadas, setSeleccionadas] = useState<Record<string, boolean>>({});
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plantillasNotas
        .filter((p) => p.campo)
        .map((p) => [p.campo!.nombre, p.campo!.defaultValue ?? ""]),
    ),
  );
  const [extra, setExtra] = useState(defaultExtra);

  const textoFinal = useMemo(() => {
    const partes = plantillasNotas
      .filter((p) => seleccionadas[p.id])
      .map((p) => `• ${renderPlantilla(p, valores)}`);
    if (extra.trim()) partes.push(extra.trim());
    return partes.join("\n");
  }, [seleccionadas, valores, extra]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
        {plantillasNotas.map((p) => (
          <div key={p.id} className="space-y-1">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!seleccionadas[p.id]}
                onChange={(e) =>
                  setSeleccionadas((prev) => ({ ...prev, [p.id]: e.target.checked }))
                }
              />
              <span>
                <strong>{p.titulo}</strong>
                <span className="text-[var(--color-text-secondary)]">
                  {" "}
                  — {renderPlantilla(p, valores)}
                </span>
              </span>
            </label>
            {p.campo && seleccionadas[p.id] ? (
              <input
                type="text"
                value={valores[p.campo.nombre] ?? ""}
                onChange={(e) =>
                  setValores((prev) => ({ ...prev, [p.campo!.nombre]: e.target.value }))
                }
                placeholder={p.campo.placeholder}
                className="ml-6 h-9 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm"
              />
            ) : null}
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        Notas adicionales libres (opcional)
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          placeholder="Detalles particulares para este registro…"
        />
      </label>

      <input type="hidden" name={name} value={textoFinal} />
    </div>
  );
}
