import Link from "next/link";
import { EliminarCotizacionMuebleButton } from "@/components/ventas/eliminar-cotizacion-mueble-button";
import { MueblesPersonalizadosContextPanels } from "@/components/ventas/muebles-personalizados-context-panels";
import { KanbanOrdenes } from "@/components/sales/kanban-ordenes";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getClientesRows,
  getCotizacionesRows,
  getCotizacionesUnificadasRows,
  getOrdenesProduccionRows,
} from "@/lib/data";
import { resumenEspeciesDesdeDetalle } from "@/lib/cotizacion-unificada-payload";
import { canMutateVentas } from "@/lib/permissions";
import { formatDate, formatPen } from "@/lib/utils";

export default async function MueblesPersonalizadosPage() {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [clientes, cotizaciones, ordenes, cotizacionesUnificadas] = await Promise.all([
    getClientesRows(),
    getCotizacionesRows(),
    getOrdenesProduccionRows(),
    getCotizacionesUnificadasRows(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const canDeleteCotizacionesMueble = role === "owner_admin" || role === "gerencia";
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));
  const cotizacionesById = new Map(cotizaciones.map((c) => [c.id, c]));
  const cotizUnificadasById = new Map(
    cotizacionesUnificadas.map((c) => [c.id, c]),
  );

  // Obtener IDs de cotizaciones que ya tienen orden de producción para evitar duplicaciones
  const ordenesCotizacionIds = new Set(ordenes.map((o) => o.cotizacion_id).filter(Boolean));
  const ordenesCotizacionUnificadaIds = new Set(ordenes.map((o) => o.cotizacion_unificada_id).filter(Boolean));

  const cotizacionesPersonalizadas = cotizaciones.filter(
    (c) => c.tipo === "mueble_personalizado",
  );

  // Filtrar cotizaciones simples aprobables (estado confirmada y sin orden)
  const aprobablesSimples = cotizacionesPersonalizadas.filter(
    (c) => c.estado === "confirmada" && !ordenesCotizacionIds.has(c.id)
  );

  // Filtrar cotizaciones unificadas (inteligentes) aprobables
  const aprobablesUnificadas = cotizacionesUnificadas.filter(
    (c) =>
      ["pendiente", "lista_produccion", "cobrada"].includes(c.estado_flujo) &&
      !ordenesCotizacionUnificadaIds.has(c.id)
  );

  // Mapear ambas a un formato de opción común
  const opcionesAprobacion = [
    ...aprobablesSimples.map((c) => ({
      id: c.id,
      label: `${c.correlativo ?? formatDate(c.fecha)} · ${clientesById.get(c.cliente_id) ?? "Cliente"} · ${formatPen(Number(c.precio_acordado))}`,
    })),
    ...aprobablesUnificadas.map((c) => ({
      id: c.id,
      label: `${c.correlativo ?? formatDate(c.fecha)} (Inteligente) · ${clientesById.get(c.cliente_id) ?? "Cliente"} · ${formatPen(Number(c.total))}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Muebles personalizados</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Lista de cotizaciones y Kanban de produccion unificados. El cotizador inteligente vive en Cotizacion.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Operaciones</CardTitle>
          <CardDescription>Nueva cotización o aprobación a orden de producción.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMutate ? (
            <MueblesPersonalizadosContextPanels
              clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
              opcionesAprobacion={opcionesAprobacion}
              mockData={comboMock}
            />
          ) : (
            <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
              Tu rol es de solo lectura.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Cotizaciones registradas</CardTitle>
        <CardDescription>
          {cotizacionesPersonalizadas.length} cotizaciones de muebles personalizados.
        </CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>N°</TH>
                <TH>Fecha</TH>
                <TH>Cliente</TH>
                <TH>Especie</TH>
                <TH>Estado</TH>
                <TH className="text-right">Calculado</TH>
                <TH className="text-right">Acordado</TH>
                <TH className="text-right">PDF</TH>
                {canDeleteCotizacionesMueble ? <TH className="text-right">Acciones</TH> : null}
              </TRow>
            </THead>
            <tbody>
              {cotizacionesPersonalizadas.map((c) => {
                const cliente = clientes.find((cli) => cli.id === c.cliente_id);
                const mensaje = `Hola ${cliente?.nombre ?? ""}, le confirmo cotización ${c.correlativo ?? ""} por ${formatPen(Number(c.precio_acordado))}.`;
                return (
                <TRow key={c.id}>
                  <TD className="font-mono text-xs">{c.correlativo ?? "—"}</TD>
                  <TD>{formatDate(c.fecha)}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      {clientesById.get(c.cliente_id) ?? "—"}
                    </span>
                  </TD>
                  <TD>{c.especie_madera}</TD>
                  <TD>
                    <Badge variant={c.estado === "confirmada" ? "success" : "neutral"}>
                      {c.estado}
                    </Badge>
                  </TD>
                  <TD className="text-right">{formatPen(Number(c.precio_calculado))}</TD>
                  <TD className="text-right font-semibold">
                    {formatPen(Number(c.precio_acordado))}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={`/ventas/muebles-personalizados/${c.id}/pdf`}
                      target="_blank"
                      className="text-xs font-semibold text-[var(--color-accent)] underline"
                    >
                      Imprimir
                    </Link>
                  </TD>
                  {canDeleteCotizacionesMueble ? (
                    <TD className="text-right">
                      <EliminarCotizacionMuebleButton correlativo={c.correlativo ?? null} id={c.id} clienteId={c.cliente_id} />
                    </TD>
                  ) : null}
                </TRow>
              );
              })}
              {cotizacionesPersonalizadas.length === 0 ? (
                <TRow>
                  <TD
                    colSpan={canDeleteCotizacionesMueble ? 9 : 8}
                    className="text-center text-[var(--color-text-secondary)]"
                  >
                    Aún no hay cotizaciones personalizadas.
                  </TD>
                </TRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Tablero Kanban de órdenes de producción</CardTitle>
        <CardDescription>
          Arrastra cada orden entre columnas para cambiar su estado. El cambio se guarda al instante.
        </CardDescription>
        <div className="mt-4">
          <KanbanOrdenes
            canMutate={canMutate}
            ordenes={ordenes.map((orden) => {
              const cot = orden.cotizacion_id
                ? cotizacionesById.get(orden.cotizacion_id) ?? null
                : null;
              const cu = orden.cotizacion_unificada_id
                ? cotizUnificadasById.get(orden.cotizacion_unificada_id) ??
                  null
                : null;
              const precio_acordado = cot
                ? Number(cot.precio_acordado)
                : cu
                  ? Number(cu.total)
                  : null;
              const especie =
                cot?.especie_madera ??
                (cu ? resumenEspeciesDesdeDetalle(cu.detalle) : null);
              return {
                id: orden.id,
                estado: orden.estado,
                cliente: clientesById.get(orden.cliente_id) ?? "Cliente",
                correlativo: orden.correlativo,
                fecha_aprobacion: orden.fecha_aprobacion,
                notas: orden.notas,
                precio_acordado,
                especie,
              };
            })}
          />
        </div>
      </Card>


    </div>
  );
}
