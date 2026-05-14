"use client";

import { createVentaMuebleTerminado } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { EntregaFormFields } from "@/components/sales/entrega-form-fields";
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Combobox } from "@/components/ui/Combobox";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field } from "@/components/ui/field";
import { liteClientesToCompleto, MOCK_MUEBLES_CATALOGO_VENTA } from "@/lib/combobox-mocks";
import type { ZonaEntregaRow } from "@/lib/demo-store";
import { formatPen } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

type ClienteOpt = { id: string; nombre: string };
type ChoferOpt = { id: string; nombre: string; telefono?: string | null; placa?: string | null };
type MuebleOpt = {
  id: string;
  codigo: string;
  nombre: string;
  precio_lista: number | string;
  stock_disponible: number | string;
};

type MueblesTerminadosContextPanelsProps = {
  clientes: ClienteOpt[];
  muebles: MuebleOpt[];
  choferes: ChoferOpt[];
  zonas: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  fechaDefault: string;
  mockData?: boolean;
};

export function MueblesTerminadosContextPanels({
  clientes,
  muebles,
  choferes,
  zonas,
  fechaDefault,
  mockData = false,
}: MueblesTerminadosContextPanelsProps) {
  const [clienteVentaId, setClienteVentaId] = useState("");
  const [muebleCatalogoId, setMuebleCatalogoId] = useState("");

  const clientesCombo = useMemo(() => liteClientesToCompleto(clientes), [clientes]);

  const muebleOptions = useMemo(() => {
    const src: MuebleOpt[] = mockData
      ? [...MOCK_MUEBLES_CATALOGO_VENTA].map((m) => ({
          id: m.id,
          codigo: m.codigo,
          nombre: m.nombre,
          precio_lista: m.precio_lista,
          stock_disponible: m.stock_disponible,
        }))
      : muebles;
    return src.map((m) => ({
      value: m.id,
      label: `${m.codigo} — ${m.nombre}`,
      sublabel: `${formatPen(Number(m.precio_lista))}${
        Number(m.stock_disponible) <= 0 ? " · sin stock" : ""
      }`,
    }));
  }, [mockData, muebles]);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Vender mueble"
        title="Nueva venta de mueble"
        description={
          <>
            Solo muebles que ya existen en el catálogo. Para dar de alta o editar precios, fotos y stock del catálogo
            usá{" "}
            <Link href="/inventario" className="font-semibold text-[var(--color-accent)] underline underline-offset-2">
              Inventario
            </Link>{" "}
            → pestaña <strong>Productos</strong> → sección <strong>Catálogo de muebles</strong>.
          </>
        }
      >
        <form action={createVentaMuebleTerminado} className="space-y-4">
          <ClienteCombobox
            mockData={mockData}
            clientes={clientesCombo}
            value={clienteVentaId}
            onChange={setClienteVentaId}
            hiddenInputName="cliente_id"
            label="Cliente"
            placeholder="Buscar cliente…"
            inputAriaLabel="Cliente para venta de mueble terminado"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
              <span>Mueble del catálogo</span>
              <Combobox
                options={muebleOptions}
                value={muebleCatalogoId}
                onChange={setMuebleCatalogoId}
                hiddenInputName="mueble_catalogo_id"
                placeholder="Buscar en catálogo…"
                inputAriaLabel="Mueble del catálogo"
              />
            </label>
            <Field name="fecha" label="Fecha" type="date" defaultValue={fechaDefault} required />
            <Field
              name="cantidad"
              label="Cantidad"
              type="number"
              min="1"
              step="1"
              defaultValue="1"
              required
            />
            <Field
              name="precio_unitario"
              label="Precio unitario regateado (S/)"
              type="number"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              Datos de entrega
            </p>
            <div className="mt-2">
              <EntregaFormFields mockData={mockData} choferes={choferes} zonas={zonas} />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              Datos de pago
            </p>
            <div className="mt-2">
              <PagoFormFields />
            </div>
          </div>

          <PendingSubmitButton idleText="Confirmar venta" />
        </form>
      </ContextActionPanel>
    </>
  );
}
