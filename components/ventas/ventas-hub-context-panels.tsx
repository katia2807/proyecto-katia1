"use client";

import { createChofer, createCliente, createProveedor } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { ClienteFormFields } from "@/components/sales/cliente-form-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type VentasHubContextPanelsProps = {
  quick: string;
};

export function VentasHubContextPanels({ quick }: VentasHubContextPanelsProps) {
  return (
    <>
      <ContextActionPanel
        key={`quick-cliente-${quick}`}
        triggerLabel="Registrar cliente"
        title="Nuevo cliente"
        description="Datos completos: persona o empresa, RUC/DNI y dirección."
        openByDefault={quick === "cliente"}
      >
        <form action={async (fd) => { await createCliente(fd); }} className="space-y-3">
          <ClienteFormFields />
          <input type="hidden" name="return_to" value="/ventas" />
          <div>
            <Button>Guardar cliente</Button>
          </div>
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        key={`quick-proveedor-${quick}`}
        triggerLabel="Registrar proveedor"
        title="Nuevo proveedor"
        description="Datos básicos del proveedor de madera o insumos."
        openByDefault={quick === "proveedor"}
      >
        <form action={createProveedor} className="grid gap-3 md:grid-cols-2">
          <Field name="nombre" label="Proveedor" required />
          <Field name="documento" label="RUC o DNI" />
          <Field name="telefono" label="Celular" />
          <input type="hidden" name="return_to" value="/ventas" />
          <div className="md:col-span-2">
            <Button>Guardar proveedor</Button>
          </div>
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        key={`quick-chofer-${quick}`}
        triggerLabel="Registrar chofer"
        title="Nuevo chofer"
        description="Para asignar entregas a obras y clientes."
        openByDefault={quick === "chofer"}
      >
        <form action={createChofer} className="grid gap-3 md:grid-cols-2">
          <Field name="nombre" label="Nombre del chofer" required />
          <Field name="telefono" label="Teléfono" inputMode="tel" />
          <Field
            name="placa"
            label="Placa de vehículo"
            placeholder="ABC-123"
            className="md:col-span-2"
          />
          <input type="hidden" name="return_to" value="/ventas/clientes?tab=base_datos" />
          <div className="md:col-span-2">
            <Button>Guardar chofer</Button>
          </div>
        </form>
      </ContextActionPanel>
    </>
  );
}
