"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { buildCajaHref, cajaFiltrosError, normalizeCajaFiltros } from "@/lib/caja-filtros";
import type { CajaFiltros } from "@/lib/caja-filtros";
import type { CajaVista } from "@/lib/caja-resumen-data";

export function CajaFiltrosForm({ filtros, vista }: { filtros: CajaFiltros; vista: CajaVista }) {
  const [error, setError] = useState(cajaFiltrosError(filtros));
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Al reutilizar una ruta guardada, el navegador puede repetir el ancla del historial.
    if (!/^#movimientos-caja(?:#|%23)/i.test(window.location.hash)) return;
    const url = new URL(window.location.href);
    url.hash = "movimientos-caja";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    document.getElementById("movimientos-caja")?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [searchParams]);

  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next = normalizeCajaFiltros(Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])));
    const nextError = cajaFiltrosError(next);
    setError(nextError);
    if (!nextError) startTransition(() => router.push(buildCajaHref(vista, next)));
  }

  return (
    <form ref={formRef} action="/caja#movimientos-caja" method="get" onSubmit={aplicar} className="space-y-3" aria-label="Filtros de movimientos de Caja" aria-busy={pending}>
      {vista !== "todos" && <input type="hidden" name="vista" value={vista} />}
      <Field name="buscar" type="search" label="Buscar movimientos" placeholder="Concepto, notas o cliente indicado" defaultValue={filtros.buscar} maxLength={160} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field name="desde" type="date" label="Desde" defaultValue={filtros.desde} onChange={() => setError(null)} aria-describedby={error ? "caja-filtros-error" : undefined} />
        <Field name="hasta" type="date" label="Hasta" defaultValue={filtros.hasta} onChange={() => setError(null)} aria-describedby={error ? "caja-filtros-error" : undefined} />
        <SelectField name="tipo" label="Tipo de movimiento" defaultValue={filtros.tipo}>
          <option value="todos">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Gastos</option>
          <option value="transferencia">Transferencias</option>
        </SelectField>
        <SelectField name="medio" label="Medio de pago" defaultValue={filtros.medio}>
          <option value="todos">Todos los medios</option>
          <option value="efectivo">Efectivo</option>
          <option value="banco">Banco</option>
          <option value="yape">Yape</option>
          <option value="otro">Otro</option>
        </SelectField>
        <SelectField name="comprobante" label="Comprobante" defaultValue={filtros.comprobante}>
          <option value="todos">Todos los comprobantes</option>
          <option value="factura">Factura</option>
          <option value="boleta">Boleta</option>
          <option value="recibo">Recibo</option>
          <option value="adjunto">Adjunto</option>
          <option value="ninguno">Sin comprobante</option>
        </SelectField>
      </div>
      {error && <p id="caja-filtros-error" role="alert" className="text-sm text-[var(--katia-danger)]">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending}>{pending ? "Buscando…" : "Aplicar filtros"}</Button>
        <Link href={buildCajaHref(vista, normalizeCajaFiltros())} onClick={() => { formRef.current?.reset(); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--katia-primary)] focus-visible:outline-2 focus-visible:outline-offset-2">Limpiar filtros</Link>
      </div>
    </form>
  );
}
