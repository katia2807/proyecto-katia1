"use client";

import { createRegistroGeneral } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";

type CategoriaOpt = { id: string; nombre: string };

type RegistroNuevoContextPanelProps = {
  categorias: CategoriaOpt[];
  defaultCategoriaId: string;
  openByDefault: boolean;
};

export function RegistroNuevoContextPanel({
  categorias,
  defaultCategoriaId,
  openByDefault,
}: RegistroNuevoContextPanelProps) {
  return (
    <ContextActionPanel
      triggerLabel="Nuevo registro"
      title="Registro rápido categorizado"
      description="Define la categoría y guarda el hecho con fecha, detalle y monto opcional."
      openByDefault={openByDefault}
    >
      <form action={createRegistroGeneral} className="grid gap-3 md:grid-cols-2">
        <SelectField name="categoria_id" label="Categoría" required defaultValue={defaultCategoriaId || ""}>
          <option value="" disabled>
            Selecciona categoría
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </SelectField>
        <Field name="fecha" type="date" label="Fecha" required />
        <Field name="titulo" label="Título" placeholder="Ingreso por corte, compra de troza..." required />
        <Field name="monto" type="number" min="0" step="0.01" label="Monto (opcional)" />
        <Field
          name="detalle"
          label="Detalle"
          placeholder="Contexto breve para análisis posterior"
          className="md:col-span-2"
        />
        <div className="md:col-span-2">
          <Button>Guardar registro</Button>
        </div>
      </form>
    </ContextActionPanel>
  );
}
