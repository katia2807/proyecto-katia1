"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const OVERLAY_Z = "z-[10120]";
const DIALOG_Z = "z-[10121]";

export type PhraseConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Texto exacto que el usuario debe escribir (p. ej. ELIMINAR). */
  expectedPhrase: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<boolean | void>;
};

/**
 * Confirmación estricta: el usuario debe escribir una frase literal antes de confirmar.
 */
export function PhraseConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  expectedPhrase,
  confirmLabel = "Confirmar eliminación",
  cancelLabel = "Cancelar",
  onConfirm,
}: PhraseConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setPhrase("");
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

  const match = phrase === expectedPhrase;

  async function handleConfirm() {
    if (!match) return;
    setBusy(true);
    try {
      const result = await onConfirm();
      if (result !== false) {
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0",
          OVERLAY_Z,
          "bg-[color-mix(in_srgb,var(--color-bg)_78%,black)] backdrop-blur-sm",
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
          DIALOG_Z,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3 border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-danger)_18%,transparent)] text-[var(--accent-danger)]">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            <div id={descId} className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {children}
              <Field
                label={`Escribí exactamente: ${expectedPhrase}`}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-surface)_40%,transparent)] px-5 py-4">
          <Button type="button" variant="secondary" className="min-w-[7rem]" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" className="min-w-[7rem]" disabled={busy || !match} onClick={handleConfirm}>
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}
