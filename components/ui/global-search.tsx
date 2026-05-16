"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type SearchItem = {
  label: string;
  detail: string;
  href: string;
  type: "Cliente" | "Producto" | "Cotizacion";
};

const typeColors: Record<SearchItem["type"], string> = {
  Cliente:    "text-[var(--katia-accent-cyan)]",
  Producto:   "text-[var(--katia-primary)]",
  Cotizacion: "text-[var(--katia-secondary)]",
};

export function GlobalSearch({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo((): Record<SearchItem["type"], SearchItem[]> => {
    const q = query.trim().toLowerCase();
    const empty: Record<SearchItem["type"], SearchItem[]> = { Cliente: [], Producto: [], Cotizacion: [] };
    if (q.length < 2) return empty;
    const filtered = items.filter((item) =>
      `${item.label} ${item.detail} ${item.type}`.toLowerCase().includes(q),
    );
    const grouped: Record<SearchItem["type"], SearchItem[]> = { Cliente: [], Producto: [], Cotizacion: [] };
    for (const item of filtered.slice(0, 12)) {
      grouped[item.type].push(item);
    }
    return grouped;
  }, [items, query]);

  const hasResults = Object.values(results).some((arr) => arr && arr.length > 0);
  const showDropdown = focused && query.trim().length >= 2;

  return (
    <div className="relative hidden min-w-[16rem] max-w-sm flex-1 md:block">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--katia-text-tertiary)]" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Buscar…"
        aria-label="Búsqueda global"
        className={cn(
          "h-10 w-full rounded-[var(--katia-radius-md)] border pl-9 pr-8 text-sm transition-all duration-150",
          "bg-[var(--katia-glass-bg)] text-[var(--katia-text-primary)]",
          "placeholder:text-[var(--katia-text-disabled)]",
          focused
            ? "border-[var(--katia-border-emphasis)] shadow-[var(--katia-shadow-focus)]"
            : "border-[var(--katia-border-default)]",
        )}
      />
      {query ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => { setQuery(""); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--katia-text-tertiary)] hover:text-[var(--katia-text-primary)]"
        >
          <IconX className="size-3.5" />
        </button>
      ) : null}

      {showDropdown ? (
        <div
          className={cn(
            "absolute left-0 right-0 top-12 z-[75] overflow-hidden",
            "rounded-[var(--katia-radius-xl)] border border-[var(--katia-glass-border)]",
            "bg-[var(--katia-bg-overlay)] backdrop-blur-[20px]",
            "shadow-[var(--katia-shadow-modal)]",
          )}
        >
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-[var(--katia-text-tertiary)]">
              Sin resultados para &ldquo;{query}&rdquo;
            </p>
          ) : (
            (["Cliente", "Producto", "Cotizacion"] as const).map((type) => {
              const group = results[type];
              if (!group?.length) return null;
              return (
                <div key={type}>
                  <p className="border-b border-[var(--katia-border-subtle)] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--katia-text-disabled)]">
                    {type === "Cotizacion" ? "Cotizaciones" : `${type}s`}
                  </p>
                  {group.map((item) => (
                    <Link
                      key={`${type}-${item.href}-${item.label}`}
                      href={item.href}
                      onClick={() => setQuery("")}
                      className="flex items-center gap-3 border-b border-[var(--katia-border-subtle)] px-4 py-2 last:border-0 transition-colors duration-100 hover:bg-[var(--katia-primary-soft)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--katia-text-primary)]">{item.label}</p>
                        <p className="truncate text-xs text-[var(--katia-text-tertiary)]">{item.detail}</p>
                      </div>
                      <span className={cn("shrink-0 text-[10px] font-semibold", typeColors[type])}>
                        {type}
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
