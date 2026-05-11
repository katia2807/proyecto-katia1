"use client";

import { eliminarDatoIndividual, eliminarDatosPorCategoria } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/field";
import { RESPALDO_CATEGORIA_OPTIONS } from "@/lib/combobox-mocks";
import { useMemo, useState } from "react";

type RespaldoPeligroCategoriaFormsProps = {
  /** Con `NEXT_PUBLIC_COMBOBOX_MOCK=true` usa subconjunto corto para pruebas locales. */
  comboMock?: boolean;
};

/** Formularios peligrosos con categoría en Combobox (lista estática ~17 ítems). */
export function RespaldoPeligroCategoriaForms({ comboMock = false }: RespaldoPeligroCategoriaFormsProps) {
  const [categoriaMasiva, setCategoriaMasiva] = useState("cotizacionesUnificadas");
  const [categoriaIndividual, setCategoriaIndividual] = useState("cotizacionesUnificadas");

  const options = useMemo(() => {
    const src = comboMock ? RESPALDO_CATEGORIA_OPTIONS.slice(0, 10) : RESPALDO_CATEGORIA_OPTIONS;
    return src.map((o) => ({
      value: o.value,
      label: o.label,
    }));
  }, [comboMock]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-[var(--color-danger)]">
        <CardTitle className="text-[var(--color-danger)]">Eliminar por categoría</CardTitle>
        <CardDescription>
          Borra todos los registros de una categoría puntual. Usa esta opción para limpiar un módulo
          completo sin tocar el resto.
        </CardDescription>
        <form action={eliminarDatosPorCategoria} className="mt-3 space-y-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Categoría</span>
            <Combobox
              options={options}
              value={categoriaMasiva}
              onChange={setCategoriaMasiva}
              hiddenInputName="categoria"
              placeholder="Buscar categoría…"
              inputAriaLabel="Categoría a eliminar por completo"
            />
          </label>
          <Field
            name="confirmacion_categoria"
            label='Confirmación (escribe: ELIMINAR CATEGORIA)'
            placeholder="ELIMINAR CATEGORIA"
            required
          />
          <Button variant="danger">Eliminar categoría completa</Button>
        </form>
      </Card>

      <Card className="border-[var(--color-danger)]">
        <CardTitle className="text-[var(--color-danger)]">Eliminar registro individual</CardTitle>
        <CardDescription>
          Elimina un solo registro por su ID exacto dentro de una categoría.
        </CardDescription>
        <form action={eliminarDatoIndividual} className="mt-3 space-y-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Categoría</span>
            <Combobox
              options={options}
              value={categoriaIndividual}
              onChange={setCategoriaIndividual}
              hiddenInputName="categoria"
              placeholder="Buscar categoría…"
              inputAriaLabel="Categoría del registro a eliminar"
            />
          </label>
          <Field
            name="id_registro"
            label="ID del registro a eliminar"
            placeholder="Pega el UUID o ID exacto"
            required
          />
          <Field
            name="confirmacion_item"
            label='Confirmación (escribe: ELIMINAR REGISTRO)'
            placeholder="ELIMINAR REGISTRO"
            required
          />
          <Button variant="danger">Eliminar solo este registro</Button>
        </form>
      </Card>
    </div>
  );
}
