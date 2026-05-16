"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "hoy",          label: "Hoy" },
  { id: "pasado",       label: "Pasado" },
  { id: "futuro",       label: "Futuro" },
  { id: "clientes360",  label: "Clientes 360°" },
  { id: "herramientas", label: "Herramientas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type CentroMandoTabsProps = {
  activeTab: string;
};

export function CentroMandoTabs({ activeTab }: CentroMandoTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    // Limpiar cliente al cambiar de tab
    if (tab !== "clientes360") params.delete("cliente");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-1 overflow-x-auto rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-elevated)] p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => navigate(tab.id)}
          className={cn(
            "flex-shrink-0 rounded-[calc(var(--katia-radius-md)-2px)] px-4 py-1.5 text-sm font-medium transition-all duration-150",
            activeTab === tab.id
              ? "bg-[var(--katia-primary-soft)] text-[var(--katia-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
              : "text-[var(--katia-text-secondary)] hover:bg-[var(--katia-glass-bg)] hover:text-[var(--katia-text-primary)]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
