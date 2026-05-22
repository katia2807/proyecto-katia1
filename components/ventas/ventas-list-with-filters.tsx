"use client";

import { useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { Search } from "lucide-react";

export type UnifiedVenta = {
  id: string;
  fecha: string;
  clienteNombre: string;
  concepto: string;
  total: number;
  categoria: "muebles" | "madera" | "aserradero" | "alquileres" | "otros";
};

type VentasListWithFiltersProps = {
  ventas: UnifiedVenta[];
};

export function VentasListWithFilters({ ventas }: VentasListWithFiltersProps) {
  const [activeCategory, setActiveCategory] = useState<string>("todas");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const categories = [
    { id: "todas", label: "Todas" },
    { id: "muebles", label: "Muebles" },
    { id: "madera", label: "Madera" },
    { id: "aserradero", label: "Aserradero" },
    { id: "alquileres", label: "Alquileres" },
    { id: "otros", label: "Otros" },
  ];

  // Filtering
  const filteredVentas = ventas.filter((v) => {
    const matchesCategory = activeCategory === "todas" || v.categoria === activeCategory;
    const matchesSearch =
      v.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.concepto.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryBadgeClass = (categoria: string) => {
    switch (categoria) {
      case "muebles":
        return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300";
      case "madera":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
      case "aserradero":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
      case "alquileres":
        return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";
      default:
        return "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-300";
    }
  };

  return (
    <Card className="overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-[var(--color-text-primary)]">
              Historial Unificado de Ventas
            </CardTitle>
            <CardDescription className="text-sm text-[var(--color-text-secondary)]">
              Visualiza y filtra todas las operaciones comerciales del negocio en tiempo real.
            </CardDescription>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder="Buscar por cliente o concepto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-2 pl-9 pr-4 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
            />
          </div>
        </div>

        {/* Categories Tab Selector */}
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === "todas" 
              ? ventas.length 
              : ventas.filter((v) => v.categoria === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                type="button"
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all select-none border ${
                  isActive
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-sm scale-[1.02]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-primary-soft)]/20 hover:text-[var(--color-text-primary)]"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TRow>
              <TH className="w-[120px]">Fecha</TH>
              <TH className="w-[200px]">Cliente</TH>
              <TH className="w-[130px]">Categoría</TH>
              <TH>Detalle / Concepto</TH>
              <TH className="w-[150px] text-right">Monto Cobrado</TH>
            </TRow>
          </THead>
          <tbody>
            {filteredVentas.map((venta) => (
              <TRow key={venta.id} className="transition-all hover:bg-[var(--color-primary-soft)]/10">
                <TD className="whitespace-nowrap font-medium text-[var(--color-text-secondary)]">
                  {formatDate(venta.fecha)}
                </TD>
                <TD className="font-semibold text-[var(--color-text-primary)]">
                  {venta.clienteNombre}
                </TD>
                <TD>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getCategoryBadgeClass(venta.categoria)}`}>
                    {venta.categoria}
                  </span>
                </TD>
                <TD className="text-sm text-[var(--color-text-secondary)]">
                  {venta.concepto}
                </TD>
                <TD className="text-right font-bold text-[var(--color-text-primary)]">
                  {formatPen(venta.total)}
                </TD>
              </TRow>
            ))}

            {filteredVentas.length === 0 && (
              <TRow>
                <TD colSpan={5} className="py-8 text-center text-[var(--color-text-secondary)]">
                  No se encontraron ventas para esta categoría o criterio de búsqueda.
                </TD>
              </TRow>
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
