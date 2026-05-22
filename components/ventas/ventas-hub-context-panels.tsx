"use client";

import { useActionState, useEffect, useState } from "react";
import {
  submitCreateClienteForm,
  submitCreateProveedorForm,
  submitCreateChoferForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { ClienteFormFields } from "@/components/sales/cliente-form-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";

type VentasHubContextPanelsProps = {
  quick: string;
};

export function VentasHubContextPanels({ quick }: VentasHubContextPanelsProps) {
  const [openCliente, setOpenCliente] = useState(quick === "cliente");
  const [clienteFormKey, setClienteFormKey] = useState(0);
  const [clienteState, clienteFormAction] = useActionState(submitCreateClienteForm, mutationFormInitialState);

  const [openProveedor, setOpenProveedor] = useState(quick === "proveedor");
  const [proveedorFormKey, setProveedorFormKey] = useState(0);
  const [proveedorState, proveedorFormAction] = useActionState(submitCreateProveedorForm, mutationFormInitialState);

  const [openChofer, setOpenChofer] = useState(quick === "chofer");
  const [choferFormKey, setChoferFormKey] = useState(0);
  const [choferState, choferFormAction] = useActionState(submitCreateChoferForm, mutationFormInitialState);

  const { showToast } = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (quick === "cliente") setOpenCliente(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (quick === "proveedor") setOpenProveedor(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (quick === "chofer") setOpenChofer(true);
  }, [quick]);

  useEffect(() => {
    if (clienteState.success && clienteState.message) {
      showToast({ variant: "success", message: clienteState.message });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenCliente(false);
      setClienteFormKey((k) => k + 1);
    } else if (clienteState.error) {
      showToast({ variant: "error", message: clienteState.error });
    }
  }, [clienteState, showToast]);

  useEffect(() => {
    if (proveedorState.success && proveedorState.message) {
      showToast({ variant: "success", message: proveedorState.message });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenProveedor(false);
      setProveedorFormKey((k) => k + 1);
    } else if (proveedorState.error) {
      showToast({ variant: "error", message: proveedorState.error });
    }
  }, [proveedorState, showToast]);

  useEffect(() => {
    if (choferState.success && choferState.message) {
      showToast({ variant: "success", message: choferState.message });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenChofer(false);
      setChoferFormKey((k) => k + 1);
    } else if (choferState.error) {
      showToast({ variant: "error", message: choferState.error });
    }
  }, [choferState, showToast]);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar cliente"
        title="Nuevo cliente"
        description="Datos completos: persona o empresa, RUC/DNI y dirección."
        open={openCliente}
        onOpenChange={(next) => {
          setOpenCliente(next);
          if (!next) {
            setClienteFormKey((k) => k + 1);
          }
        }}
        replacePathOnClose="/ventas"
      >
        <form key={clienteFormKey} action={clienteFormAction} className="space-y-3">
          <ClienteFormFields />
          <input type="hidden" name="return_to" value="/ventas" />
          <div>
            <Button>Guardar cliente</Button>
          </div>
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        triggerLabel="Registrar proveedor"
        title="Nuevo proveedor"
        description="Datos básicos del proveedor de madera o insumos."
        open={openProveedor}
        onOpenChange={(next) => {
          setOpenProveedor(next);
          if (!next) {
            setProveedorFormKey((k) => k + 1);
          }
        }}
        replacePathOnClose="/ventas"
      >
        <form key={proveedorFormKey} action={proveedorFormAction} className="grid gap-3 md:grid-cols-2">
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
        triggerLabel="Registrar chofer"
        title="Nuevo chofer"
        description="Para asignar entregas a obras y clientes."
        open={openChofer}
        onOpenChange={(next) => {
          setOpenChofer(next);
          if (!next) {
            setChoferFormKey((k) => k + 1);
          }
        }}
        replacePathOnClose="/ventas/clientes?tab=base_datos"
      >
        <form key={choferFormKey} action={choferFormAction} className="grid gap-3 md:grid-cols-2">
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

