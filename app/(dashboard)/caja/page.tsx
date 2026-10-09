import Link from "next/link";
import { CajaContextPanels } from "@/components/caja/caja-context-panels";
import { CajaMasterDetail } from "@/components/caja/caja-master-detail";
import { CajaResumen } from "@/components/caja/caja-resumen";
import { CajaFiltrosForm } from "@/components/caja/caja-filtros-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth";
import { getCajaPanelData } from "@/lib/caja-resumen-data";
import { canAccessPath, canMutateCaja } from "@/lib/permissions";
import { formatPen } from "@/lib/utils";
import { buildCajaHref, cajaFiltrosError, cajaTieneFiltros, CAJA_HISTORY_PAGE_SIZE, normalizeCajaFiltros } from "@/lib/caja-filtros";
import type { CajaSearchParams } from "@/lib/caja-filtros";
import { listadoTamano } from "@/lib/listado-paginacion";

type CajaPageProps = {
  searchParams?: Promise<CajaSearchParams>;
};

function normalizeVista(value: string | string[] | undefined): "todos" | "personal" | "empresa" {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "personal" || v === "empresa") return v;
  return "todos";
}

export default async function CajaPage({ searchParams }: CajaPageProps) {
  const params = await searchParams;
  const vista = normalizeVista(params?.vista);
  const filtros = normalizeCajaFiltros(params);
  const filtrosActivos = cajaTieneFiltros(filtros);
  const filtrosError = cajaFiltrosError(filtros);
  const context = await getAuthContext();
  const role = context?.role ?? null;
  const canMutate = canMutateCaja(role, context?.uiRole);
  const data = await getCajaPanelData(vista, context?.organizationId, filtros);
  const resumen = vista === "personal" ? data.personal : data.empresa;
  const rows = data.rows;
  const pageSize = listadoTamano(filtros.por_pagina, CAJA_HISTORY_PAGE_SIZE);

  const tabs: { value: typeof vista; label: string; hint: string }[] = [
    { value: "todos", label: "Todos", hint: data.ok ? `${data.empresa.movimientos + data.personal.movimientos} ${data.empresa.movimientos + data.personal.movimientos === 1 ? "movimiento" : "movimientos"}` : "No disponible" },
    { value: "empresa", label: "Empresa", hint: data.ok ? `Saldo ${formatPen(data.empresa.saldo)}` : "No disponible" },
    { value: "personal", label: "Personal", hint: data.ok ? `${data.personal.movimientos} ${data.personal.movimientos === 1 ? "movimiento separado" : "movimientos separados"}` : "No disponible" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Caja</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Consulta el dinero registrado en la empresa y los movimientos personales por separado.
        </p>
      </div>

      <CajaResumen resumen={resumen} vista={vista} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Nuevo movimiento con notas opcionales, medio, origen y comprobante.</CardDescription>
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2">
            <CajaContextPanels vista={vista} />
          </div>
        ) : (
          <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
            Tu rol tiene vista de caja, pero no permisos para registrar movimientos.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const activo = tab.value === vista;
          const href = buildCajaHref(tab.value, filtros);
          return (
            <Link key={tab.value} href={href} aria-current={activo ? "page" : undefined} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
              <div
                className={`rounded-xl border px-3 py-2 text-left ${
                  activo
                    ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)]/40"
                    : "border-[var(--color-border)] bg-[var(--color-surface)]"
                }`}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{tab.hint}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <Card id="movimientos-caja" className="scroll-mt-20 space-y-4">
        <CardTitle>Movimientos</CardTitle>
        <CardDescription>
          {vista === "personal"
            ? "Solo movimientos personales, separados de la empresa."
            : vista === "empresa"
              ? "Ingresos y gastos registrados de la empresa."
              : "Vista combinada de personal y empresa."}
        </CardDescription>
        <CajaFiltrosForm key={buildCajaHref(vista, filtros, data.ok ? data.pagina : filtros.pagina)} filtros={filtros} vista={vista} />
        <p className="text-xs text-[var(--katia-text-secondary)]">Los filtros solo cambian esta lista. El resumen superior y el saldo de Empresa incluyen todo el historial.</p>
        <div>
          {data.ok ? (
            <>
              <p role="status" className="mb-3 text-sm text-[var(--katia-text-secondary)]">
                {filtrosError ? "Corrige las fechas para consultar los resultados." : `${data.totalResultados} ${data.totalResultados === 1 ? "movimiento encontrado" : "movimientos encontrados"}${filtrosActivos ? " con estos filtros" : ""}.${data.totalResultados > pageSize ? ` Mostrando ${(data.pagina - 1) * pageSize + 1}–${(data.pagina - 1) * pageSize + rows.length}, del más reciente al más antiguo.` : ""}`}
              </p>
              {!filtrosError && <CajaMasterDetail rows={rows} cajaHref={buildCajaHref(vista, filtros, data.pagina)} canOpenOrigen={Boolean(context && (canAccessPath(context.role, context.uiRole, "/ventas") || canAccessPath(context.role, context.uiRole, "/cotizacion")))} emptyMessage={data.totalVista === 0 ? "Aún no hay movimientos en esta vista de Caja." : undefined} userRole={context?.uiRole === "readonly" ? "vendedor" : role} />}
              {!filtrosError && data.totalResultados > pageSize && (
                <nav aria-label="Páginas de movimientos de Caja" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  {data.pagina > 1 ? <Link href={buildCajaHref(vista, filtros, data.pagina - 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 font-semibold focus-visible:outline-2">Anterior</Link> : <span />}
                  <span>Página {data.pagina} de {Math.ceil(data.totalResultados / pageSize)}</span>
                  {data.pagina * pageSize < data.totalResultados ? <Link href={buildCajaHref(vista, filtros, data.pagina + 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 font-semibold focus-visible:outline-2">Siguiente</Link> : <span />}
                </nav>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-[var(--katia-text-secondary)]">Movimientos no disponibles. Usa Reintentar en el resumen para volver a cargarlos.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
