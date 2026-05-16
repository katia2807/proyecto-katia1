"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const SEEN_KEY = "katia_urgencias_seen";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export type UrgenciaItem = {
  key: string;
  titulo: string;
  detalle: string;
  href: string;
  cta: string;
  count: number;
};

export function UrgenciasPanel({ urgencias }: { urgencias: UrgenciaItem[] }) {
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const today = getTodayStr();
      const seen = new Set<string>();
      for (const [k, d] of Object.entries(parsed)) {
        if (d === today) seen.add(k);
      }
      setSeenKeys(seen);
    } catch {
      // ignore
    }
  }, []);

  function markSeen(key: string) {
    const today = getTodayStr();
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[key] = today;
      localStorage.setItem(SEEN_KEY, JSON.stringify(parsed));
    } catch {
      // ignore
    }
    setSeenKeys((prev) => new Set([...prev, key]));
  }

  if (urgencias.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--katia-radius-lg)] border border-[var(--katia-success)]/30 bg-[var(--katia-success)]/8 px-5 py-4">
        <span className="text-xl">✓</span>
        <div>
          <p className="text-sm font-semibold text-[var(--katia-success)]">Sin urgencias hoy</p>
          <p className="text-xs text-[var(--katia-text-secondary)]">
            Stock, cobros, ventas y personal están al día.
          </p>
        </div>
        <Link
          href="/gerencial"
          className="ml-auto shrink-0 text-xs font-semibold text-[var(--katia-primary)] hover:underline"
        >
          Ver análisis completo →
        </Link>
      </div>
    );
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {urgencias.map((u) => {
        const seen = seenKeys.has(u.key);
        return (
          <Link
            key={u.key}
            href={u.href}
            onClick={() => markSeen(u.key)}
            className="group block"
          >
            <div
              className={`h-full rounded-[var(--katia-radius-lg)] border p-4 transition-colors ${
                seen
                  ? "border-[var(--katia-warning)]/40 bg-[var(--katia-warning)]/8 hover:border-[var(--katia-warning)]/60 hover:bg-[var(--katia-warning)]/12"
                  : "border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/5 hover:border-[var(--katia-danger)]/60 hover:bg-[var(--katia-danger)]/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--katia-text-primary)]">{u.titulo}</p>
                  <p className="mt-0.5 text-xs text-[var(--katia-text-secondary)]">{u.detalle}</p>
                </div>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    seen ? "bg-[var(--katia-warning)]" : "bg-[var(--katia-danger)]"
                  }`}
                >
                  {u.count}
                </span>
              </div>
              <p
                className={`mt-3 text-xs font-semibold group-hover:underline ${
                  seen ? "text-[var(--katia-warning)]" : "text-[var(--katia-danger)]"
                }`}
              >
                {seen ? "Ya revisado — click para ir →" : `${u.cta} →`}
              </p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
