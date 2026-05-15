"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";

type SearchItem = {
  label: string;
  detail: string;
  href: string;
  type: "Cliente" | "Producto" | "Cotizacion";
};

export function GlobalSearch({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return items
      .filter((item) => `${item.label} ${item.detail} ${item.type}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, query]);

  return (
    <div className="relative hidden min-w-[18rem] max-w-md flex-1 md:block">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar clientes, productos o cotizaciones"
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--bg-primary)] pl-9 pr-3 text-sm"
      />
      {results.length > 0 ? (
        <div className="absolute left-0 right-0 top-12 z-[75] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--bg-card)] shadow-2xl">
          {results.map((item) => (
            <Link
              key={`${item.type}-${item.href}-${item.label}`}
              href={item.href}
              onClick={() => setQuery("")}
              className="block border-b border-[var(--color-border)] px-3 py-2 hover:bg-[var(--bg-surface)]"
            >
              <p className="text-xs font-semibold text-[var(--color-accent)]">{item.type}</p>
              <p className="truncate text-sm font-medium">{item.label}</p>
              <p className="truncate text-xs text-[var(--color-text-secondary)]">{item.detail}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
