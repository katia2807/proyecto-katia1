"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  submitCreateClienteForm,
  submitCreateProveedorForm,
  submitCreateChoferForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { ClienteFormFields } from "@/components/sales/cliente-form-fields";
import { ProveedorFormFields } from "@/components/ventas/registrar-proveedor-inline";
import { ChoferFormFields } from "@/components/ventas/registrar-chofer-inline";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";

type VentasHubContextPanelsProps = {
  quick: string;
};

export function VentasHubContextPanels({ quick }: VentasHubContextPanelsProps) {
  const router = useRouter();
  const [openCliente, setOpenCliente] = useState(quick === "cliente");
  const [clienteFormKey, setClienteFormKey] = useState(0);
  const [clienteState, setClienteState] = useState(mutationFormInitialState);
  const [clienteLoading, setClienteLoading] = useState(false);

  async function handleClienteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (clienteLoading) return;
    const formData = new FormData(event.currentTarget);
    setClienteLoading(true);
    setClienteState(mutationFormInitialState);
    try {
      setClienteState(await submitCreateClienteForm(mutationFormInitialState, formData));
    } catch (e) {
      setClienteState({ success: false, message: null, error: e instanceof Error ? e.message : "No se pudo registrar el cliente." });
    } finally {
      setClienteLoading(false);
    }
  }

  const [openProveedor, setOpenProveedor] = useState(quick === "proveedor");
  const [proveedorFormKey, setProveedorFormKey] = useState(0);
  const [proveedorState, proveedorFormAction] = useActionState(submitCreateProveedorForm, mutationFormInitialState);

  const [openChofer, setOpenChofer] = useState(quick === "chofer");
  const [choferFormKey, setChoferFormKey] = useState(0);
  const [choferState, choferFormAction] = useActionState(submitCreateChoferForm, mutationFormInitialState);

  const { showToast } = useToast();

  useEffect(() => {
    if (quick === "cliente") setOpenCliente(true);
    if (quick === "proveedor") setOpenProveedor(true);
    if (quick === "chofer") setOpenChofer(true);
  }, [quick]);

  useEffect(() => {
    if (clienteState.success && clienteState.message) {
      showToast({ variant: "success", message: clienteState.message });
      setOpenCliente(false);
      setClienteFormKey((k) => k + 1);
      router.refresh();
      window.location.reload();
    } else if (clienteState.error) {
      showToast({ variant: "error", message: clienteState.error });
    }
  }, [clienteState, showToast, router]);

  useEffect(() => {
    if (proveedorState.success && proveedorState.message) {
      showToast({ variant: "success", message: proveedorState.message });
      setOpenProveedor(false);
      setProveedorFormKey((k) => k + 1);
      router.refresh();
      window.location.reload();
    } else if (proveedorState.error) {
      showToast({ variant: "error", message: proveedorState.error });
    }
  }, [proveedorState, showToast, router]);

  useEffect(() => {
    if (choferState.success && choferState.message) {
      showToast({ variant: "success", message: choferState.message });
      setOpenChofer(false);
      setChoferFormKey((k) => k + 1);
      router.refresh();
      window.location.reload();
    } else if (choferState.error) {
      showToast({ variant: "error", message: choferState.error });
    }
  }, [choferState, showToast, router]);

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
        <form key={clienteFormKey} onSubmit={handleClienteSubmit} className="space-y-3">
          <ClienteFormFields />
          {clienteState.error ? <p role="alert" className="text-sm text-[var(--katia-danger)]">{clienteState.error}</p> : null}
          <div>
            <Button disabled={clienteLoading}>{clienteLoading ? "Guardando…" : "Guardar cliente"}</Button>
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
        <form key={proveedorFormKey} action={proveedorFormAction} className="flex flex-col gap-3">
          <ProveedorFormFields prefixDatalist="hub-proveedor" />
          <input type="hidden" name="return_to" value="/ventas" />
          <div>
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
        <form key={choferFormKey} action={choferFormAction} className="flex flex-col gap-3">
          <ChoferFormFields prefixDatalist="hub-chofer" />
          <input type="hidden" name="return_to" value="/ventas/clientes?tab=base_datos" />
          <div>
            <Button>Guardar chofer</Button>
          </div>
        </form>
      </ContextActionPanel>
    </>
  );
}

