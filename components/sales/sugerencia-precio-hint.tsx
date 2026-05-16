"use client";

import { IconBulb } from "@tabler/icons-react";
import { formatearSugerencia, type SugerenciaPrecio } from "@/lib/precio-sugerido";
import { cn } from "@/lib/utils";

type SugerenciaPrecioHintProps = {
  sugerencia: SugerenciaPrecio;
  onUsar?: (precio: number) => void;
  className?: string;
};

/**
 * Muestra la sugerencia de precio basada en historial.
 * Solo se renderiza si sugerencia.mostrar === true.
 * El cliente siempre tiene control total — esto es solo un hint.
 */
export function SugerenciaPrecioHint({ sugerencia, onUsar, className }: SugerenciaPrecioHintProps) {
  if (!sugerencia.mostrar) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[var(--katia-radius-sm)] border border-[var(--katia-primary)]/25",
        "bg-[var(--katia-primary-soft)] px-3 py-2 text-xs",
        className,
      )}
    >
      <IconBulb className="mt-0.5 size-3.5 shrink-0 text-[var(--katia-primary)]" />
      <div className="min-w-0 flex-1">
        <span className="text-[var(--katia-text-secondary)]">
          {formatearSugerencia(sugerencia)}
        </span>
        {onUsar ? (
          <button
            type="button"
            onClick={() => onUsar(sugerencia.promedio)}
            className="ml-2 text-[var(--katia-primary)] underline hover:no-underline"
          >
            Usar sugerencia
          </button>
        ) : null}
      </div>
    </div>
  );
}
