"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SEEN_KEY = "katia_gerencial_alertas_seen";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

type PendienteItem = {
  href: string;
  texto: string;
  prioridad: "alta" | "media" | "baja";
};

type Props = {
  alertasCriticas: number;
  pendientesHoy: PendienteItem[];
};

export function AlertasBannerHoy({ alertasCriticas, pendientesHoy }: Props) {
  const [seenToday, setSeenToday] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw === getTodayStr()) {
        setSeenToday(true);
      }
    } catch {
      // ignore
    }
  }, []);

  function markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, getTodayStr());
    } catch {
      // ignore
    }
    setSeenToday(true);
  }

  if (alertasCriticas === 0 && pendientesHoy.length === 0) {
    return (
      <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-success)]/30 bg-[var(--katia-success)]/8 px-4 py-3 text-sm text-[var(--katia-success)]">
        Sin pendientes urgentes. ¡Todo bajo control!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Banner crítico con color dinámico */}
      {alertasCriticas > 0 ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-[var(--katia-radius-md)] border px-4 py-3 transition-colors ${
            seenToday
              ? "border-[var(--katia-warning)]/40 bg-[var(--katia-warning)]/10"
              : "border-[var(--katia-danger)]/40 bg-[var(--katia-danger)]/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                seenToday ? "bg-[var(--katia-warning)]" : "bg-[var(--katia-danger)]"
              }`}
            >
              {alertasCriticas}
            </span>
            <p className="text-sm font-medium text-[var(--katia-text-primary)]">
              {seenToday
                ? `${alertasCriticas} alerta(s) revisada(s) — pendiente de resolver.`
                : alertasCriticas === 1
                ? "Hay 1 alerta crítica que requiere atención."
                : `Hay ${alertasCriticas} alertas críticas que requieren atención.`}
            </p>
          </div>
          {!seenToday ? (
            <button
              type="button"
              onClick={markSeen}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[var(--katia-text-secondary)] hover:bg-[var(--katia-surface-raised)] transition-colors"
            >
              Marcar revisado
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Lista de pendientes priorizados */}
      {pendientesHoy.length > 0 ? (
        <div className="space-y-2">
          {pendientesHoy.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-4 rounded-[var(--katia-radius-md)] border px-4 py-3 transition-colors hover:border-[var(--katia-border-emphasis)] hover:bg-[var(--katia-primary-soft)] ${
                seenToday
                  ? "border-[var(--katia-warning)]/30 bg-[var(--katia-warning)]/5"
                  : "border-[var(--katia-border-subtle)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    item.prioridad === "alta"
                      ? seenToday
                        ? "bg-[var(--katia-warning)]"
                        : "bg-[var(--katia-danger)]"
                      : item.prioridad === "media"
                      ? "bg-[var(--katia-warning)]"
                      : "bg-[var(--katia-text-tertiary)]"
                  }`}
                />
                <p className="text-sm text-[var(--katia-text-primary)]">{item.texto}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[var(--katia-primary)]">
                Abrir →
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
