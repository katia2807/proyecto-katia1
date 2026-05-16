"use client";

import { useState } from "react";
import { IconBell, IconBellFilled, IconCheck, IconExternalLink } from "@tabler/icons-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  tipo: "stock_bajo" | "cotizacion_vencida" | "cobro_pendiente" | "sistema" | "alerta";
  titulo: string;
  mensaje?: string | null;
  href?: string | null;
  leida: boolean;
  prioridad: "alta" | "media" | "baja";
  created_at: string;
};

const tipoColor = {
  stock_bajo:          "bg-[var(--katia-warning)] text-white",
  cotizacion_vencida:  "bg-[var(--katia-danger)] text-white",
  cobro_pendiente:     "bg-[var(--katia-info)] text-white",
  sistema:             "bg-[var(--katia-primary)] text-white",
  alerta:              "bg-[var(--katia-danger)] text-white",
} satisfies Record<Notification["tipo"], string>;

const prioridadDot = {
  alta:  "bg-[var(--katia-danger)]",
  media: "bg-[var(--katia-warning)]",
  baja:  "bg-[var(--katia-text-tertiary)]",
} satisfies Record<Notification["prioridad"], string>;

type NotificationBellProps = {
  notifications: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
};

export function NotificationBell({ notifications, onMarkRead, onMarkAllRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.leida).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${unreadCount} notificaciones sin leer`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-[var(--katia-radius-md)]",
          "border border-[var(--katia-border-default)] text-[var(--katia-text-secondary)]",
          "transition-all duration-150 hover:bg-[var(--katia-primary-soft)] hover:text-[var(--katia-text-primary)]",
          open && "bg-[var(--katia-primary-soft)] border-[var(--katia-border-emphasis)]",
        )}
      >
        {unreadCount > 0 ? (
          <IconBellFilled className="size-4 text-[var(--katia-primary)]" />
        ) : (
          <IconBell className="size-4" />
        )}
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--katia-danger)] text-[9px] font-bold text-white"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              "absolute right-0 top-11 z-50 w-80 rounded-[var(--katia-radius-xl)]",
              "border border-[var(--katia-glass-border)]",
              "bg-[var(--katia-bg-overlay)] backdrop-blur-[20px]",
              "shadow-[var(--katia-shadow-modal)]",
            )}
          >
            <div className="flex items-center justify-between border-b border-[var(--katia-border-subtle)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--katia-text-primary)]">
                Notificaciones
                {unreadCount > 0 ? (
                  <span className="ml-2 rounded-full bg-[var(--katia-primary-soft)] px-2 py-0.5 text-xs text-[var(--katia-primary)]">
                    {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </h3>
              {unreadCount > 0 && onMarkAllRead ? (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-xs text-[var(--katia-primary)] hover:underline"
                >
                  Marcar todo leído
                </button>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <IconBell className="size-8 text-[var(--katia-text-disabled)]" />
                  <p className="text-sm text-[var(--katia-text-tertiary)]">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 border-b border-[var(--katia-border-subtle)] last:border-0",
                      "transition-colors duration-100",
                      !n.leida && "bg-[var(--katia-primary-soft)]",
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      <span className={cn("block size-2 rounded-full", prioridadDot[n.prioridad])} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--katia-text-primary)]">{n.titulo}</p>
                      {n.mensaje ? (
                        <p className="mt-0.5 text-xs text-[var(--katia-text-secondary)] line-clamp-2">{n.mensaje}</p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", tipoColor[n.tipo])}>
                          {n.tipo.replace(/_/g, " ")}
                        </span>
                        {n.href ? (
                          <Link
                            href={n.href}
                            className="flex items-center gap-0.5 text-xs text-[var(--katia-primary)] hover:underline"
                            onClick={() => setOpen(false)}
                          >
                            Abrir <IconExternalLink className="size-3" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    {!n.leida && onMarkRead ? (
                      <button
                        type="button"
                        onClick={() => onMarkRead(n.id)}
                        aria-label="Marcar como leída"
                        className="shrink-0 text-[var(--katia-text-tertiary)] hover:text-[var(--katia-success)] transition-colors"
                      >
                        <IconCheck className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
