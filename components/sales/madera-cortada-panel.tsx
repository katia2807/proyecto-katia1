"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContextActionPanel } from "@/components/context-action-panel";
import { MaderaCortadaForm } from "@/components/sales/madera-cortada-form";
import { VentaMaderaForm } from "@/components/sales/venta-madera-form";
import type { ZonaEntregaRow } from "@/lib/demo-store";

type Cliente = { id: string; nombre: string };
type Chofer = { id: string; nombre: string; telefono?: string | null; placa?: string | null };
type Producto = {
  id: string;
  nombre: string;
  unidad: string;
  stock_actual: number | string;
  categoria: string;
  costo_unitario?: number | string | null;
};

type Props = {
  clientes: Cliente[];
  choferes: Chofer[];
  productos: Producto[];
  zonas: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  mockData?: boolean;
};

export function MaderaCortadaPanel({ clientes, choferes, productos, zonas, mockData }: Props) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [tipoVenta, setTipoVenta] = useState<"cortada" | "clasica">("cortada");
  const router = useRouter();

  function handleSuccess() {
    setOpen(false);
    setFormKey((k) => k + 1);
    router.refresh();
  }

  return (
    <ContextActionPanel
      triggerLabel="Registrar venta de madera"
      title="Registrar venta de madera"
      description="Selecciona el tipo de venta que deseas realizar para continuar."
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <div className="space-y-4">
        {/* Selector de Tipo de Venta segmentado premium */}
        <div className="flex rounded-xl bg-[var(--color-primary-soft)]/20 p-1 border border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setTipoVenta("cortada")}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all duration-200 ${
              tipoVenta === "cortada"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            📐 Madera Cortada (Cubicaje)
          </button>
          <button
            type="button"
            onClick={() => setTipoVenta("clasica")}
            className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all duration-200 ${
              tipoVenta === "clasica"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            🪵 Madera Clásica (Rápida)
          </button>
        </div>

        {tipoVenta === "cortada" ? (
          <MaderaCortadaForm
            key={`cortada-${formKey}`}
            clientes={clientes}
            choferes={choferes}
            productos={productos}
            zonas={zonas}
            mockData={mockData}
            onSuccess={handleSuccess}
          />
        ) : (
          <VentaMaderaForm
            key={`clasica-${formKey}`}
            clientes={clientes}
            productos={productos}
            mockData={mockData}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </ContextActionPanel>
  );
}
