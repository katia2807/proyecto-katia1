import Link from "next/link";
import { EliminarCotizacionMuebleButton } from "@/components/ventas/eliminar-cotizacion-mueble-button";
import { MueblesPersonalizadosContextPanels } from "@/components/ventas/muebles-personalizados-context-panels";
import { CotizadorInteligente } from "@/components/cotizador-inteligente";
import { KanbanOrdenes } from "@/components/sales/kanban-ordenes";
import { WhatsAppButton } from "@/components/sales/whatsapp-button";
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

  const cotizacionesPersonalizadas = cotizaciones.filter(
    (c) => c.tipo === "mueble_personalizado",
  );
  const aprobables = cotizacionesPersonalizadas.filter((c) => c.estado === "confirmada");
  const opcionesAprobacion = aprobables.map((c) => ({
    id: c.id,
    label: `${c.correlativo ?? formatDate(c.fecha)} · ${clientesById.get(c.cliente_id) ?? "Cliente"} · ${formatPen(Number(c.precio_acordado))}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Muebles personalizados</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Cotizador inteligente, aprobación a orden de producción y tablero de seguimiento por estado.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Acciones rápidas</CardTitle>
          <CardDescription>
            Crear cotización detallada o aprobar una existente como nueva orden.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMutate ? (
            <MueblesPersonalizadosContextPanels
              clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
              opcionesAprobacion={opcionesAprobacion}
              mockData={comboMock}
            />
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
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
                      <WhatsAppButton telefono={cliente?.telefono ?? null} mensaje={mensaje} />
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
                      <EliminarCotizacionMuebleButton correlativo={c.correlativo ?? null} id={c.id} />
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

      <Card>
        <CardTitle>Cotizador inteligente</CardTitle>
        <CardDescription>
          Asistente paso a paso para calcular costo de madera, insumos y utilidad neta.
        </CardDescription>
        <div className="mt-3">
          <CotizadorInteligente canSave={canMutate} />
        </div>
      </Card>
    </div>
  );
}
