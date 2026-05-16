"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "cuenta", label: "Mi cuenta" },
  { id: "empresa", label: "Empresa" },
  { id: "preferencias", label: "Preferencias" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type ConfiguracionTabsProps = {
  activeTab: string;
};

export function ConfiguracionTabs({ activeTab }: ConfiguracionTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
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
