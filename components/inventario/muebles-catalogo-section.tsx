"use client";

import {
  submitCreateMuebleCatalogoForm,
  submitToggleMuebleCatalogoForm,
  submitUpdateMuebleCatalogoForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { FotoUpload } from "@/components/sales/foto-upload";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { formatPen } from "@/lib/utils";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";

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

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{row.codigo}</p>
          <p className="text-base font-semibold">{row.nombre}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
          {row.activo ? "Activo" : "Inactivo"}
        </span>
      </div>
      {row.foto_url ? (
        <Image
          src={row.foto_url}
          alt={row.nombre}
          width={260}
          height={140}
          className="h-28 w-full rounded-xl object-cover"
          unoptimized
        />
      ) : null}
      <form action={actionEdit} className="grid gap-2">
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
        <Field name="foto_url" label="Foto URL (opcional)" defaultValue={row.foto_url ?? ""} />
        <div>
          <Button type="submit" variant="secondary" disabled={!canMutate}>
            Guardar cambios
          </Button>
        </div>
      </form>
      <form action={actionToggle}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="activo" value={row.activo ? "false" : "true"} />
        <Button type="submit" variant={row.activo ? "danger" : "secondary"} disabled={!canMutate}>
          {row.activo ? "Desactivar" : "Activar"}
        </Button>
      </form>
      <p className="text-sm font-semibold">{formatPen(Number(row.precio_lista))}</p>
    </Card>
  );
}

export function MueblesCatalogoSection({ muebles, canMutate }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
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
          <CardDescription>Gestiona precio sugerido, descripcion y estado para cotizaciones de mueble terminado.</CardDescription>
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
            <form key={formKey} action={actionCreate} className="grid gap-3 md:grid-cols-2">
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
