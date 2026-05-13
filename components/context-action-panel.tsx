"use client";

import type React from "react";
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OVERLAY_Z = "z-[9998]";
const PANEL_Z = "z-[9999]";

type ContextActionPanelProps = {
  triggerLabel: string;
  title: string;
  description: string;
  children: React.ReactNode;
  openByDefault?: boolean;
  /** Modo controlado: `open` + `onOpenChange` (p. ej. cerrar tras guardar con éxito). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * drawer: panel lateral derecho.
   * dialog: ventana centrada (por defecto; evita recortes por el layout y el cierre con X funciona siempre).
   */
  presentation?: "drawer" | "dialog";
  /**
   * Tras cerrar (X, overlay o Escape), navega aquí sin query.
   */
  replacePathOnClose?: string;
};

export function ContextActionPanel({
  triggerLabel,
  title,
  description,
  children,
  openByDefault = false,
  open: controlledOpen,
  onOpenChange,
  presentation = "dialog",
  replacePathOnClose,
}: ContextActionPanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(openByDefault);
  const isControlled = controlledOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange(next);
      } else {
        setUncontrolledOpen(next);
      }
    },
    [isControlled, onOpenChange],
  );
  /** Tras hidratar en el cliente, montamos el portal en `document.body` (SSR devuelve false y coincide con el servidor). */
  const portalReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const titleId = useId();
  const router = useRouter();
  const isDialog = presentation === "dialog";

  const handleClose = useCallback(() => {
    setOpen(false);
    if (replacePathOnClose) {
      router.replace(replacePathOnClose);
    }
  }, [replacePathOnClose, router, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const header = (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] px-6 py-5">
      <div>
        <h3 id={titleId} className="text-lg font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={handleClose}
        className="h-9 shrink-0 px-3"
        aria-label="Cerrar"
      >
        <X className="size-4" />
      </Button>
    </div>
  );

  const body = (
    <div className="max-h-[min(72dvh,34rem)] overflow-y-auto px-6 py-5">
      <div className="pb-2">{children}</div>
    </div>
  );

  const overlay = (
    <div
      className={cn(
        "fixed inset-0 transition-opacity",
        OVERLAY_Z,
        "bg-[color-mix(in_srgb,var(--color-bg)_65%,black)] backdrop-blur-[2px]",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      onClick={handleClose}
      aria-hidden={!open}
    />
  );

  const floatingLayer =
    isDialog ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed left-1/2 top-1/2 flex h-fit w-[min(calc(100vw-1.5rem),42rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] transition duration-200 ease-out motion-reduce:transition-none",
          PANEL_Z,
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-[0.97] opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!open}
      >
        {header}
        {body}
      </div>
    ) : (
      <aside
        className={cn(
          "fixed right-4 top-4 flex max-h-[min(92dvh,52rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
          PANEL_Z,
          open
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0",
        )}
        aria-hidden={!open}
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-col overflow-hidden">
          {header}
          {body}
        </div>
      </aside>
    );

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      {portalReady && typeof document !== "undefined"
        ? createPortal(
            <>
              {overlay}
              {floatingLayer}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

