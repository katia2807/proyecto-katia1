"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitUpdateClienteFicha } from "@/app/actions";
import { ClienteFormFields } from "@/components/sales/cliente-form-fields";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Button } from "@/components/ui/button";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { clienteFichaSnapshot, type ClienteFichaSnapshot } from "@/lib/cliente-contacto";
type Cliente = ClienteFichaSnapshot & { id: string };
function FichaForm({ cliente, onSuccess, onPendingChange }: { cliente: Cliente; onSuccess: () => void; onPendingChange: (pending: boolean) => void }) {
  const [state, action, pending] = useActionState(submitUpdateClienteFicha, mutationFormInitialState);
  useEffect(() => { onPendingChange(pending); return () => onPendingChange(false); }, [pending, onPendingChange]);
  useEffect(() => { if (state.success) onSuccess(); }, [state, onSuccess]);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="cliente_id" value={cliente.id} />
    <input type="hidden" name="ficha_anterior" value={JSON.stringify(clienteFichaSnapshot(cliente))} />
    <ClienteFormFields defaultNombre={cliente.nombre} defaultTipoPersona={cliente.tipo_persona ?? ""}
      defaultDocumento={cliente.documento ?? ""} defaultRuc={cliente.ruc ?? ""}
      defaultTelefono={cliente.telefono ?? ""} defaultDireccion={cliente.direccion ?? ""}
      defaultDatosAdicionales={cliente.datos_adicionales} showBothDocuments />
    {state.error ? <p role="alert" className="text-sm text-[var(--katia-danger)]">{state.error}</p> : null}
    <Button disabled={pending}>{pending ? "Guardando…" : "Guardar cambios del cliente"}</Button>
  </form>;
}
export function ClienteFichaEditor({ cliente }: { cliente: Cliente }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <ContextActionPanel triggerLabel="Editar datos" title="Datos del cliente" description="Revisa y corrige los datos antes de guardarlos."
    open={open} onOpenChange={setOpen} busy={busy}>
    {open ? <FichaForm cliente={cliente} onPendingChange={setBusy} onSuccess={() => { setOpen(false); router.refresh(); }} /> : null}
  </ContextActionPanel>;
}
