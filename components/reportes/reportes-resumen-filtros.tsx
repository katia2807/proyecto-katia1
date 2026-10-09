"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { cajaCategoriaLabel } from "@/lib/caja-presentacion";
import { normalizeReportesResumen, reportesResumenError, type ReportesResumenFiltros } from "@/lib/reportes-resumen";
import { LISTADO_TAMANOS } from "@/lib/listado-paginacion";

export function ReportesResumenFiltrosForm({ filtros, categorias, pageSize }: { filtros: ReportesResumenFiltros; categorias: string[]; pageSize: number }) {
  const [error, setError] = useState(reportesResumenError(filtros));
  return (
    <form action="/reportes#resumen-caja" method="get" className="mt-4 space-y-3" aria-label="Filtros del resumen de Reportes" onSubmit={event => {
      const next = normalizeReportesResumen(Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string,string>);
      const message = reportesResumenError(next);
      setError(message);
      if (message) event.preventDefault();
    }}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Desde" name="desde" type="date" defaultValue={filtros.desde} />
        <Field label="Hasta" name="hasta" type="date" defaultValue={filtros.hasta} />
        <SelectField label="Categoría" name="categoria" defaultValue={filtros.categoria}>
          <option value="">Todas las categorías</option>
          {categorias.map(categoria => <option key={categoria} value={categoria}>{cajaCategoriaLabel(categoria)}</option>)}
        </SelectField>
        <SelectField label="Ámbito" name="ambito" defaultValue={filtros.ambito}>
          <option value="todos">Empresa y personal</option>
          <option value="empresa">Empresa</option>
          <option value="personal">Personal</option>
        </SelectField>
      </div>
      {error ? <p role="alert" className="text-sm text-[var(--katia-danger)]">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <SelectField name="por_pagina" label="Filas del detalle por página" defaultValue={pageSize}>
          {LISTADO_TAMANOS.map(size => <option key={size} value={size}>{size}</option>)}
        </SelectField>
        <Button>Aplicar selección</Button>
        <Link href="/reportes#resumen-caja" className="rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2">Limpiar selección</Link>
      </div>
    </form>
  );
}
