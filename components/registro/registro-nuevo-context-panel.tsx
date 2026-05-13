"use client";

import { submitRegistroGeneralForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/field";
import { MOCK_CATEGORIAS_REGISTRO } from "@/lib/combobox-mocks";
import { mutationFormInitialState, type MutationFormState } from "@/lib/mutation-form-state";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";

type CategoriaOpt = { id: string; nombre: string };

type RegistroNuevoContextPanelProps = {
  categorias: CategoriaOpt[];
  defaultCategoriaId: string;
  openByDefault: boolean;
  mockData?: boolean;
};

function RegistroFormBody({
  categorias,
  mockData,
  defaultCategoriaId,
  onCloseAndReset,
}: {
  categorias: CategoriaOpt[];
  mockData: boolean;
  defaultCategoriaId: string;
  onCloseAndReset: () => void;
}) {
  const [categoriaId, setCategoriaId] = useState(defaultCategoriaId || "");
  const [categoriaError, setCategoriaError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [state, formAction] = useActionState(
    async (_p: MutationFormState, formData: FormData) => submitRegistroGeneralForm(_p, formData),
    mutationFormInitialState,
  );

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onCloseAndReset();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onCloseAndReset]);

  const categoriaOptions = useMemo(() => {
    const src = mockData ? MOCK_CATEGORIAS_REGISTRO : categorias;
    return src.map((c) => ({
      value: c.id,
      label: c.nombre,
    }));
  }, [mockData, categorias]);

  return (
    <form
      action={formAction}
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        if (!categoriaId.trim()) {
          e.preventDefault();
          setCategoriaError("Debes seleccionar una categoría");
          return;
        }
        setCategoriaError(null);
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
        <span>Categoría</span>
        <Combobox
          options={categoriaOptions}
          value={categoriaId}
          onChange={(v) => {
            setCategoriaId(v);
            if (v.trim()) setCategoriaError(null);
          }}
          hiddenInputName="categoria_id"
          placeholder="Buscar categoría…"
          inputAriaLabel="Categoría del registro"
        />
        {categoriaError ? (
          <span role="alert" className="text-sm font-medium text-[var(--color-danger)]">
            {categoriaError}
          </span>
        ) : null}
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
        <Button type="submit">Guardar registro</Button>
      </div>
    </form>
  );
}

export function RegistroNuevoContextPanel({
  categorias,
  defaultCategoriaId,
  openByDefault,
  mockData = false,
}: RegistroNuevoContextPanelProps) {
  const [open, setOpen] = useState(openByDefault);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (openByDefault) setOpen(true);
  }, [openByDefault]);

  const closeAndReset = useCallback(() => {
    setOpen(false);
    setFormKey((k) => k + 1);
  }, []);

  return (
    <ContextActionPanel
      triggerLabel="Nuevo registro"
      title="Nuevo registro"
      description="Elegí categoría, fecha y detalle; el monto es opcional."
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <RegistroFormBody
        key={formKey}
        categorias={categorias}
        mockData={mockData}
        defaultCategoriaId={defaultCategoriaId}
        onCloseAndReset={closeAndReset}
      />
    </ContextActionPanel>
  );
}
