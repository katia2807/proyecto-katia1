"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DetailDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  editLabel?: string;
  fullPageHref?: string;
  onClose: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
};

export function DetailDrawer({
  open,
  title,
  description,
  editLabel = "Editar",
  fullPageHref,
  onClose,
  onEdit,
  children,
}: DetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[199] bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
        className={cn(
          "fixed right-0 top-0 z-[200] flex h-full w-full flex-col",
          "border-l border-[var(--color-border)] bg-[var(--bg-card)] shadow-2xl",
          "md:w-[680px] lg:w-[780px]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-5">
          <div className="min-w-0">
            <h2 id="detail-drawer-title" className="truncate text-lg font-bold">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--bg-surface)]"
            aria-label="Cerrar"
          >
            <IconX className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] p-4">
          {fullPageHref ? (
            <Link href={fullPageHref}>
              <Button type="button" variant="secondary">
                Ver pagina completa
              </Button>
            </Link>
          ) : null}
          {onEdit ? (
            <Button type="button" onClick={onEdit}>
              {editLabel}
            </Button>
          ) : null}
        </footer>
      </aside>
    </>,
    document.body,
  );
}

export function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
