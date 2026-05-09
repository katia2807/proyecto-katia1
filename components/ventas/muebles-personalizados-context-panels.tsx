"use client";

import { aprobarCotizacionAOrden, createCotizacion } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { NotasSelector } from "@/components/sales/notas-selector";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";

type ClienteOpt = { id: string; nombre: string };
type AprobableOpt = { id: string; label: string };

type MueblesPersonalizadosContextPanelsProps = {
  clientes: ClienteOpt[];
  opcionesAprobacion: AprobableOpt[];
};

export function MueblesPersonalizadosContextPanels({
  clientes,
  opcionesAprobacion,
}: MueblesPersonalizadosContextPanelsProps) {
  return (
    <>
      <ContextActionPanel
        triggerLabel="Nueva cotización"
        title="Cotización personalizada"
        description="Cliente, especie, precio calculado y precio acordado."
      >
        <form action={createCotizacion} className="grid gap-3 md:grid-cols-2">
          <SelectField name="cliente_id" label="Cliente" defaultValue="" required>
            <option value="" disabled>
              Selecciona cliente
            </option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </SelectField>
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
          <SelectField name="cotizacion_id" label="Cotización" defaultValue="" required>
            <option value="" disabled>
              Selecciona cotización
            </option>
            {opcionesAprobacion.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </SelectField>
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
