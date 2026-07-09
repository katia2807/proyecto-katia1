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
import { resumenEspeciesDesdeDetalle, parseCotizacionDetalle } from "@/lib/cotizacion-unificada-payload";
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

  // Obtener IDs de cotizaciones que ya tienen orden de produccion para evitar duplicaciones
  const ordenesCotizacionIds = new Set(ordenes.map((o) => o.cotizacion_id).filter(Boolean));
  const ordenesCotizacionUnificadaIds = new Set(ordenes.map((o) => o.cotizacion_unificada_id).filter(Boolean));

  const cotizacionesPersonalizadas = cotizaciones.filter(
    (c) => c.tipo === "mueble_personalizado",
  );

  // Filtrar cotizaciones unificadas (inteligentes) que incluyan rubro de muebles
  const cotizacionesUnificadasMuebles = cotizacionesUnificadas.filter((c) => {
    const d = parseCotizacionDetalle(c.detalle);
    return d.rubros.muebles === true;
  });

  const todasLasCotizaciones = [
    ...cotizacionesPersonalizadas.map((c) => ({
      id: c.id,
      correlativo: c.correlativo,
      fecha: c.fecha,
      clienteId: c.cliente_id,
      especie: c.especie_madera,
      estado: c.estado,
      precioCalculado: Number(c.precio_calculado),
      precioAcordado: Number(c.precio_acordado),
      tipo: "legacy" as const,
      printUrl: `/ventas/muebles-personalizados/${c.id}/pdf`,
    })),
    ...cotizacionesUnificadasMuebles.map((c) => {
      const especie = resumenEspeciesDesdeDetalle(c.detalle) ?? "Mueble";
      let estadoUI = c.estado_flujo as string;
      if (c.estado_flujo === "pendiente") estadoUI = "pendiente";
      else if (c.estado_flujo === "lista_produccion") estadoUI = "lista prod.";
      else if (c.estado_flujo === "en_produccion") estadoUI = "producción";
      else if (c.estado_flujo === "cobrada") estadoUI = "cobrada";
      return {
        id: c.id,
        correlativo: c.correlativo,
        fecha: c.fecha,
        clienteId: c.cliente_id,
        especie,
        estado: estadoUI,
        precioCalculado: Number(c.total),
        precioAcordado: Number(c.total),
        tipo: "unificada" as const,
        printUrl: `/cotizacion/unificada/${c.id}/pdf`,
      };
    })
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const cotizacionesPendientes = todasLasCotizaciones.filter((c) => c.estado === "pendiente");
  const ordenesEnProduccion = ordenes.filter((o) => o.estado === "en_produccion");

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

  // Mapear ambas a un formato de opcion comun
  const opcionesAprobacion = [
    ...aprobablesSimples.map((c) => ({
      id: c.id,
      label: `${c.correlativo ?? formatDate(c.fecha)} - ${clientesById.get(c.cliente_id) ?? "Cliente"} - ${formatPen(Number(c.precio_acordado))}`,
    })),
    ...aprobablesUnificadas.map((c) => ({
      id: c.id,
      label: `${c.correlativo ?? formatDate(c.fecha)} (Inteligente) - ${clientesById.get(c.cliente_id) ?? "Cliente"} - ${formatPen(Number(c.total))}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Muebles personalizados</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Cotizaciones, pedidos y seguimiento de producción de muebles personalizados.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5">
        <div className="space-y-2">
          <CardTitle>Crear cotización de mueble personalizado</CardTitle>
          <CardDescription>
            Usa la venta guiada para registrar el pedido del cliente y calcular el total.
          </CardDescription>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Primero crea la cotización guiada. Luego podrás aprobarla o seguirla desde este módulo.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
            <Badge variant="neutral">{todasLasCotizaciones.length} cotizaciones registradas</Badge>
            <Badge variant="neutral">{ordenesEnProduccion.length} en producción</Badge>
            <Badge variant="neutral">{cotizacionesPendientes.length} pendientes</Badge>
          </div>
        </div>
        <Link
          href="/cotizacion"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          Abrir cotizador guiado
        </Link>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-3 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-2xl">
          <CardTitle className="text-base">¿Quieres vender un mueble ya terminado?</CardTitle>
          <CardDescription className="mt-1">
            Si el producto ya existe en stock, usa el catálogo de muebles terminados para seleccionarlo y registrar la venta.
          </CardDescription>
        </div>
        <Link
          href="/ventas/muebles-terminados"
          className="inline-flex items-center justify-center rounded-xl border border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white"
        >
          Ver catálogo de muebles terminados
        </Link>
      </Card>

      <Card>
        <CardTitle>Pedidos y cotizaciones registradas</CardTitle>
        <CardDescription>
          {todasLasCotizaciones.length} cotizaciones de muebles personalizados.
        </CardDescription>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Nó</TH>
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
              {todasLasCotizaciones.map((c) => {
                return (
                <TRow key={c.id}>
                  <TD className="font-mono text-xs">{c.correlativo ?? "-"}</TD>
                  <TD>{formatDate(c.fecha)}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-2">
                      {clientesById.get(c.clienteId) ?? "-"}
                    </span>
                  </TD>
                  <TD>{c.especie}</TD>
                  <TD>
                    <Badge variant={c.estado === "confirmada" || c.estado === "lista prod." || c.estado === "cobrada" ? "success" : "neutral"}>
                      {c.estado}
                    </Badge>
                  </TD>
                  <TD className="text-right">{formatPen(Number(c.precioCalculado))}</TD>
                  <TD className="text-right font-semibold">
                    {formatPen(Number(c.precioAcordado))}
                  </TD>
                  <TD className="text-right">
                    <Link
                      href={c.printUrl}
                      target="_blank"
                      className="text-xs font-semibold text-[var(--color-accent)] underline"
                    >
                      Imprimir
                    </Link>
                  </TD>
                  {canDeleteCotizacionesMueble ? (
                    <TD className="text-right">
                      <EliminarCotizacionMuebleButton correlativo={c.correlativo ?? null} id={c.id} clienteId={c.clienteId} tipo={c.tipo} />
                    </TD>
                  ) : null}
                </TRow>
              );
              })}
              {todasLasCotizaciones.length === 0 ? (
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
        <CardTitle>Seguimiento de producción</CardTitle>
        <CardDescription>
          Revisa el estado de cada pedido y mueve las órdenes cuando corresponda.
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

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Acciones avanzadas</CardTitle>
          <CardDescription>Aprobación a orden de producción y herramientas del módulo.</CardDescription>
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
    </div>
  );
}
