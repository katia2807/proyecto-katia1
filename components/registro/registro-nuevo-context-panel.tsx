"use client";

import { createRegistroGeneral } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/field";
import { MOCK_CATEGORIAS_REGISTRO } from "@/lib/combobox-mocks";
import { useEffect, useMemo, useState } from "react";

type CategoriaOpt = { id: string; nombre: string };

type RegistroNuevoContextPanelProps = {
  categorias: CategoriaOpt[];
  defaultCategoriaId: string;
  openByDefault: boolean;
  mockData?: boolean;
};

export function RegistroNuevoContextPanel({
  categorias,
  defaultCategoriaId,
  openByDefault,
  mockData = false,
}: RegistroNuevoContextPanelProps) {
  const [categoriaId, setCategoriaId] = useState(defaultCategoriaId || "");

  useEffect(() => {
    setCategoriaId(defaultCategoriaId || "");
  }, [defaultCategoriaId]);

  const categoriaOptions = useMemo(() => {
    const src = mockData ? MOCK_CATEGORIAS_REGISTRO : categorias;
    return src.map((c) => ({
      value: c.id,
      label: c.nombre,
    }));
  }, [mockData, categorias]);

  return (
    <ContextActionPanel
      triggerLabel="Nuevo registro"
      title="Registro rápido categorizado"
      description="Define la categoría y guarda el hecho con fecha, detalle y monto opcional."
      openByDefault={openByDefault}
    >
      <form action={createRegistroGeneral} className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
          <span>Categoría</span>
          <Combobox
            options={categoriaOptions}
            value={categoriaId}
            onChange={setCategoriaId}
            hiddenInputName="categoria_id"
            placeholder="Buscar categoría…"
            inputAriaLabel="Categoría del registro"
          />
        </label>
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
