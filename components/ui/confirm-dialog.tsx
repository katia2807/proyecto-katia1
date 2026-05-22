"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OVERLAY_Z = "z-[10100]";
const DIALOG_Z = "z-[10101]";
const OVERLAY_Z_FRONT = "z-[10130]";
const DIALOG_Z_FRONT = "z-[10131]";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Contenido principal (párrafos, listas). */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Si devuelve `false`, el modal permanece abierto (p. ej. error de servidor). */
  onConfirm: () => void | Promise<boolean | void>;
  /** Variante visual del botón de confirmación. */
  confirmVariant?: "danger" | "primary";
  /** neutral: encabezado sin tono de alerta (p. ej. guardar cambios). */
  tone?: "caution" | "neutral";
  /** Apila el modal por encima de diálogos de confirmación por frase (z más alto). */
  stackAbovePhraseConfirm?: boolean;
};

/**
 * Diálogo de confirmación in-app (sin `window.confirm`), alineado al tema oscuro del ERP.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  confirmVariant = "danger",
  tone = "caution",
  stackAbovePhraseConfirm = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setSubmitError(null);
  }, [open]);

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
      if (e.key === "Escape" && !busy) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onOpenChange]);

  async function handleConfirm() {
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await onConfirm();
      if (result !== false) {
        onOpenChange(false);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Ocurrió un error al confirmar.");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  const overlayZ = stackAbovePhraseConfirm ? OVERLAY_Z_FRONT : OVERLAY_Z;
  const dialogZ = stackAbovePhraseConfirm ? DIALOG_Z_FRONT : DIALOG_Z;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 transition-opacity",
          overlayZ,
          "bg-[color-mix(in_srgb,var(--color-bg)_72%,black)] backdrop-blur-sm",
        )}
        aria-hidden
        onClick={() => {
          if (!busy) onOpenChange(false);
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "fixed left-1/2 top-1/2 flex w-[min(calc(100vw-1.5rem),26rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--border-radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)]",
          dialogZ,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3 border-b border-[var(--border-color)] px-5 py-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              tone === "neutral"
                ? "bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] text-[var(--color-accent)]"
                : "bg-[color-mix(in_srgb,var(--accent-danger)_18%,transparent)] text-[var(--accent-danger)]",
            )}
          >
            {tone === "neutral" ? (
              <CircleCheck className="size-5" aria-hidden />
            ) : (
              <AlertTriangle className="size-5" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            <div id={descId} className="mt-2 space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {children}
              {submitError ? (
                <p className="rounded-lg border border-red-500/25 bg-red-50/50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200" role="alert">
                  {submitError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-surface)_40%,transparent)] px-5 py-4">
          <Button type="button" variant="secondary" className="min-w-[7rem]" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            className="min-w-[7rem]"
            disabled={busy}
            onClick={handleConfirm}
          >
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
