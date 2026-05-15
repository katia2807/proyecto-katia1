"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type AlertItem = {
  id: string;
  category: "inventario" | "cobranza" | "ordenes" | "general";
  href: string;
  detail: string;
};

type GerencialAlertasPanelProps = {
  alertasCriticas: string[];
};

const categoryLabel: Record<AlertItem["category"], string> = {
  cobranza: "Cobranza",
  inventario: "Inventario",
  ordenes: "Órdenes",
  general: "Revisión",
};

function parseAlertas(alertasCriticas: string[]): AlertItem[] {
  return alertasCriticas.map((alerta, index) => {
    if (alerta.startsWith("Stock bajo:")) {
      return {
        id: `stock-${index}`,
        category: "inventario",
        href: "/inventario",
        detail: alerta,
      };
    }
    if (alerta.startsWith("Cobro vencido:")) {
      return {
        id: `cobro-${index}`,
        category: "cobranza",
        href: "/reportes#cobros-vencidos",
        detail: alerta,
      };
    }
    if (alerta.startsWith("Orden sin entregar:")) {
      return {
        id: `orden-${index}`,
        category: "ordenes",
        href: "/ventas/muebles-personalizados",
        detail: alerta,
      };
    }
    return {
      id: `general-${index}`,
      category: "general",
      href: "/reportes",
      detail: alerta,
    };
  });
}

export function GerencialAlertasPanel({ alertasCriticas }: GerencialAlertasPanelProps) {
  const items = useMemo(() => parseAlertas(alertasCriticas), [alertasCriticas]);
  const [activeCategory, setActiveCategory] = useState<AlertItem["category"] | null>(null);

  const groupedByCategory = useMemo(() => {
    return items.reduce<Record<AlertItem["category"], AlertItem[]>>(
      (acc, item) => {
        acc[item.category].push(item);
        return acc;
      },
      {
        cobranza: [],
        inventario: [],
        ordenes: [],
        general: [],
      },
    );
  }, [items]);

  const availableCategories = (Object.keys(groupedByCategory) as AlertItem["category"][]).filter(
    (category) => groupedByCategory[category].length > 0,
  );

  const activeItems = activeCategory ? groupedByCategory[activeCategory] : [];

  return (
    <Card>
      <CardTitle>Alertas</CardTitle>
      <CardDescription>
        Selecciona una categoría de alerta para ver la acción recomendada y acceder a la herramienta.
      </CardDescription>
      <div className="mt-4 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {availableCategories.map((category) => (
            <Button
              key={category}
              type="button"
              variant={activeCategory === category ? "primary" : "secondary"}
              className="whitespace-nowrap"
              onClick={() => setActiveCategory(activeCategory === category ? null : category)}
            >
              {categoryLabel[category]}
            </Button>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          {activeCategory ? (
            <>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold">Alertas de {categoryLabel[activeCategory]}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Revisa solo lo necesario y avanza cuando estés listo.
                  </p>
                </div>

                <div className="space-y-3">
                  {activeItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)]/5 p-3">
                      <p className="text-sm">{item.detail}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link href={item.href} className="text-sm font-semibold text-[var(--accent-primary)] underline">
                          Abrir herramienta
                        </Link>
                        <Button type="button" variant="secondary" onClick={() => setActiveCategory(null)}>
                          Volver al panel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No muestres todas las alertas a la vez. Elige una categoría y verás la información breve y la acción recomendada.
              </p>
              {availableCategories.length === 0 ? (
                <p className="text-sm font-semibold">No hay alertas críticas activas.</p>
              ) : (
                <p className="text-sm">
                  Presiona un botón para comenzar: {availableCategories.map((category) => categoryLabel[category]).join(", ")}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
