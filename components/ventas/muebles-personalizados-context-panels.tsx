"use client";

import { aprobarCotizacionAOrden, createCotizacion } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { NotasSelector } from "@/components/sales/notas-selector";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field, SelectField } from "@/components/ui/field";
import { liteClientesToCompleto, MOCK_COTIZACIONES_APROBACION } from "@/lib/combobox-mocks";
import { useMemo, useState } from "react";

type ClienteOpt = { id: string; nombre: string };
type AprobableOpt = { id: string; label: string };

type MueblesPersonalizadosContextPanelsProps = {
  clientes: ClienteOpt[];
  opcionesAprobacion: AprobableOpt[];
  mockData?: boolean;
};

export function MueblesPersonalizadosContextPanels({
  clientes,
  opcionesAprobacion,
  mockData = false,
}: MueblesPersonalizadosContextPanelsProps) {
  const [clienteCotId, setClienteCotId] = useState("");
  const [cotizacionAprId, setCotizacionAprId] = useState("");

  const clientesCombo = useMemo(() => liteClientesToCompleto(clientes), [clientes]);

  const cotizacionAprOptions = useMemo(() => {
    const src = mockData ? MOCK_COTIZACIONES_APROBACION : opcionesAprobacion;
    return src.map((o) => ({
      value: o.id,
      label: o.label,
    }));
  }, [mockData, opcionesAprobacion]);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Nueva cotización"
        title="Cotización personalizada"
        description="Cliente, especie, precio calculado y precio acordado."
      >
        <form action={createCotizacion} className="grid gap-3 md:grid-cols-2">
          <ClienteCombobox
            mockData={mockData}
            clientes={clientesCombo}
            value={clienteCotId}
            onChange={setClienteCotId}
            hiddenInputName="cliente_id"
            label="Cliente"
            placeholder="Buscar cliente…"
            inputAriaLabel="Cliente para cotización personalizada"
          />
          <Field name="fecha" type="date" label="Fecha" required />
          <input type="hidden" name="tipo" value="mueble_personalizado" />
          <Field
            name="especie_madera"
            label="Especie de madera"
            placeholder="Tornillo / Pino / Cedro"
            required
          />
          <SelectField name="unidad_medida" label="Unidad base" defaultValue="cm">
            <option value="cm">Centímetros</option>
            <option value="in">Pulgadas</option>
            <option value="otro">Otra</option>
          </SelectField>
          <Field
            name="precio_calculado"
            label="Precio calculado (S/)"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <Field
            name="precio_acordado"
            label="Precio acordado (S/)"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <SelectField name="estado" label="Estado" defaultValue="confirmada">
            <option value="borrador">Borrador</option>
            <option value="confirmada">Confirmada</option>
          </SelectField>
          <div className="md:col-span-2">
            <NotasSelector name="motivo_ajuste" label="Notas para incluir en la cotización" />
          </div>
          <div className="md:col-span-2">
            <Button>Guardar cotización</Button>
          </div>
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        triggerLabel="Aceptar (orden + adelanto)"
        title="Aceptar cotización confirmada"
        description="En un solo paso: crea la orden de producción y registra el adelanto en caja."
      >
        <form action={aprobarCotizacionAOrden} className="grid gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Cotización</span>
            <Combobox
              options={cotizacionAprOptions}
              value={cotizacionAprId}
              onChange={setCotizacionAprId}
              hiddenInputName="cotizacion_id"
              placeholder="Buscar cotización confirmada…"
              inputAriaLabel="Cotización para pasar a orden"
            />
          </label>
          <Field
            name="notas"
            label="Notas para el taller"
            placeholder="Acabado, materiales, fechas estimadas…"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              name="adelanto"
              label="Adelanto cobrado (S/) — opcional"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
            />
            <SelectField name="metodo_adelanto" label="Medio del adelanto" defaultValue="efectivo">
              <option value="efectivo">Efectivo</option>
              <option value="yape">Yape</option>
              <option value="banco">Banco</option>
              <option value="otro">Otro</option>
            </SelectField>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Si dejas el adelanto en 0, solo se crea la orden. Si pones un monto &gt; 0, se asienta como
            ingreso en caja con la categoría
            <strong> adelanto_mueble_personalizado</strong>.
          </p>
          <Button>Aceptar cotización</Button>
        </form>
      </ContextActionPanel>
    </>
  );
}
