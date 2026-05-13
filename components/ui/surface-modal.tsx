"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OVERLAY_Z = "z-[10020]";
const PANEL_Z = "z-[10021]";

export type SurfaceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Contenido fijo bajo el scroll (p. ej. botones). */
  footer?: ReactNode;
};

/**
 * Ventana modal centrada (misma familia visual que el resto del ERP), sin icono de alerta.
 */
export function SurfaceModal({ open, onOpenChange, title, description, children, footer }: SurfaceModalProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0",
          OVERLAY_Z,
          "bg-[color-mix(in_srgb,var(--color-bg)_72%,black)] backdrop-blur-sm",
        )}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed left-1/2 top-1/2 flex max-h-[min(90dvh,40rem)] w-[min(calc(100vw-1.5rem),32rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)]",
          PANEL_Z,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary)]">
              {title}
            </h2>
            {description ? (
              <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</div>
            ) : null}
          </div>
          <Button type="button" variant="secondary" className="h-9 shrink-0 px-3" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-3">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}
