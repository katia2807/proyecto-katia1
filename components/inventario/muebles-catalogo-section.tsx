"use client";

import {
  deleteMuebleCatalogo,
  submitCreateMuebleCatalogoForm,
  submitToggleMuebleCatalogoForm,
  submitUpdateMuebleCatalogoForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { FotoUpload } from "@/components/sales/foto-upload";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { formatPen } from "@/lib/utils";
import { useActionState, useEffect, useRef, useState } from "react";

type MuebleRow = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_lista: number | string;
  foto_url: string | null;
  activo: boolean;
};

type Props = {
  muebles: MuebleRow[];
  canMutate: boolean;
};

function MuebleEditableRow({ row, canMutate }: { row: MuebleRow; canMutate: boolean }) {
  const { showToast } = useToast();
  const [stateEdit, actionEdit] = useActionState(submitUpdateMuebleCatalogoForm, mutationFormInitialState);
  const [stateToggle, actionToggle] = useActionState(submitToggleMuebleCatalogoForm, mutationFormInitialState);

  const [confirmGuardar, setConfirmGuardar] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editFormRef = useRef<HTMLFormElement>(null);
  const toggleFormRef = useRef<HTMLFormElement>(null);
  // These refs prevent the confirm dialogs from re-opening when requestSubmit() re-fires onSubmit
  const editConfirmedRef = useRef(false);
  const toggleConfirmedRef = useRef(false);

  useEffect(() => {
    if (stateEdit.success && stateEdit.message) {
      showToast({ variant: "success", message: stateEdit.message });
    } else if (stateEdit.error) {
      showToast({ variant: "error", message: stateEdit.error });
    }
  }, [stateEdit, showToast]);

  useEffect(() => {
    if (stateToggle.success && stateToggle.message) {
      showToast({ variant: "success", message: stateToggle.message });
    } else if (stateToggle.error) {
      showToast({ variant: "error", message: stateToggle.error });
    }
  }, [stateToggle, showToast]);

  async function handleEliminar() {
    setDeleting(true);
    const res = await deleteMuebleCatalogo(row.id);
    setDeleting(false);
    if (!res.ok) {
      showToast({ variant: "error", message: res.error });
      return false;
    }
    showToast({ variant: "success", message: "Mueble eliminado del catálogo." });
  }

  return (
    <Card id={`mueble-catalogo-${row.id}`} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{row.codigo}</p>
          <p className="text-base font-semibold">{row.nombre}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
          {row.activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Edit form — includes FotoUpload for changing the image */}
      <form
        ref={editFormRef}
        action={actionEdit}
        className="grid gap-2"
        onSubmit={(e) => {
          if (editConfirmedRef.current) {
            editConfirmedRef.current = false;
            return;
          }
          e.preventDefault();
          setConfirmGuardar(true);
        }}
      >
        <input type="hidden" name="id" value={row.id} />
        <Field
          name="precio_lista"
          label="Precio sugerido (S/)"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={String(row.precio_lista)}
        />
        <Field
          name="descripcion"
          label="Descripción"
          placeholder="Material, medidas, acabado..."
          defaultValue={row.descripcion ?? ""}
        />
        <FotoUpload
          bucket="muebles"
          name="foto_url"
          label="Foto del mueble (opcional)"
          defaultUrl={row.foto_url ?? ""}
        />
        <div>
          <Button type="submit" variant="secondary" disabled={!canMutate}>
            Guardar cambios
          </Button>
        </div>
      </form>

      {/* Activate / Deactivate / Delete */}
      <form
        ref={toggleFormRef}
        action={actionToggle}
        onSubmit={(e) => {
          if (toggleConfirmedRef.current) {
            toggleConfirmedRef.current = false;
            return;
          }
          e.preventDefault();
          setConfirmToggle(true);
        }}
      >
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="activo" value={row.activo ? "false" : "true"} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant={row.activo ? "danger" : "secondary"} disabled={!canMutate}>
            {row.activo ? "Desactivar" : "Activar"}
          </Button>
          {!row.activo && canMutate ? (
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => setConfirmEliminar(true)}
            >
              Eliminar
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm font-semibold">{formatPen(Number(row.precio_lista))}</p>

      <ConfirmDialog
        open={confirmGuardar}
        onOpenChange={setConfirmGuardar}
        title="¿Guardar cambios?"
        tone="neutral"
        confirmVariant="primary"
        confirmLabel="Guardar"
        onConfirm={() => {
          setConfirmGuardar(false);
          editConfirmedRef.current = true;
          editFormRef.current?.requestSubmit();
        }}
      >
        <p>Se actualizará el precio, descripción o foto de <strong>{row.nombre}</strong>.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmToggle}
        onOpenChange={setConfirmToggle}
        title={row.activo ? "¿Desactivar este mueble?" : "¿Activar este mueble?"}
        tone={row.activo ? "caution" : "neutral"}
        confirmVariant={row.activo ? "danger" : "primary"}
        confirmLabel={row.activo ? "Desactivar" : "Activar"}
        onConfirm={() => {
          setConfirmToggle(false);
          toggleConfirmedRef.current = true;
          toggleFormRef.current?.requestSubmit();
        }}
      >
        {row.activo ? (
          <p>
            <strong>{row.nombre}</strong> dejará de mostrarse en cotizaciones y ventas de mueble terminado.
            Podés volver a activarlo cuando quieras.
          </p>
        ) : (
          <p>
            <strong>{row.nombre}</strong> volverá a estar disponible en cotizaciones y ventas.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmEliminar}
        onOpenChange={setConfirmEliminar}
        title="¿Eliminar este mueble?"
        tone="caution"
        confirmVariant="danger"
        confirmLabel="Eliminar permanentemente"
        onConfirm={handleEliminar}
      >
        <p>
          Se eliminará <strong>{row.nombre}</strong> ({row.codigo}) del catálogo de forma permanente.
          Esta acción no se puede deshacer.
        </p>
      </ConfirmDialog>
    </Card>
  );
}

export function MueblesCatalogoSection({ muebles, canMutate }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confirmCrear, setConfirmCrear] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
  const createConfirmedRef = useRef(false);
  const [stateCreate, actionCreate] = useActionState(submitCreateMuebleCatalogoForm, mutationFormInitialState);

  useEffect(() => {
    if (stateCreate.success && stateCreate.message) {
      showToast({ variant: "success", message: stateCreate.message });
      setOpen(false);
      setFormKey((k) => k + 1);
    } else if (stateCreate.error) {
      showToast({ variant: "error", message: stateCreate.error });
    }
  }, [stateCreate, showToast]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Catalogo de muebles</CardTitle>
          <CardDescription>
            Aquí se da de alta y se mantiene el catálogo de muebles terminados. Ventas y cotizaciones solo eligen ítems
            que existan acá (no hay alta de catálogo en el módulo de ventas).
          </CardDescription>
        </div>
        {canMutate ? (
          <ContextActionPanel
            triggerLabel="Agregar mueble"
            title="Nuevo mueble del catalogo"
            description="Se publicara para seleccion en cotizacion de mueble terminado."
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setFormKey((k) => k + 1);
            }}
          >
            <form
              key={formKey}
              ref={createFormRef}
              action={actionCreate}
              className="grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                if (createConfirmedRef.current) {
                  createConfirmedRef.current = false;
                  return;
                }
                e.preventDefault();
                setConfirmCrear(true);
              }}
            >
              <Field name="codigo" label="Codigo" placeholder="CAT-001" required />
              <Field name="nombre" label="Nombre" required />
              <Field className="md:col-span-2" name="descripcion" label="Descripcion" />
              <Field name="precio_lista" label="Precio sugerido (S/)" type="number" min="0" step="0.01" required />
              <Field name="stock_disponible" label="Stock inicial" type="number" min="0" step="1" defaultValue="0" />
              <div className="md:col-span-2">
                <FotoUpload bucket="muebles" name="foto_url" label="Foto opcional del mueble" />
              </div>
              <div className="md:col-span-2">
                <Button>Guardar mueble</Button>
              </div>
            </form>

            <ConfirmDialog
              open={confirmCrear}
              onOpenChange={setConfirmCrear}
              title="¿Registrar nuevo mueble?"
              tone="neutral"
              confirmVariant="primary"
              confirmLabel="Registrar"
              onConfirm={() => {
                setConfirmCrear(false);
                createConfirmedRef.current = true;
                createFormRef.current?.requestSubmit();
              }}
            >
              <p>El mueble quedará disponible para selección en cotizaciones y ventas de mueble terminado.</p>
            </ConfirmDialog>
          </ContextActionPanel>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {muebles.map((row) => (
          <MuebleEditableRow key={row.id} row={row} canMutate={canMutate} />
        ))}
        {muebles.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
            Aun no hay muebles en el catalogo.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
