import Link from "next/link";
import {
  aprobarCotizacionAOrden,
  cambiarEstadoOrden,
  createCotizacion,
} from "@/app/actions";
import { voidFormAction } from "@/lib/void-form-action";
import { ContextActionPanel } from "@/components/context-action-panel";
import { CotizadorInteligente } from "@/components/cotizador-inteligente";
import { KanbanOrdenes } from "@/components/sales/kanban-ordenes";
import { NotasSelector } from "@/components/sales/notas-selector";
import { WhatsAppButton } from "@/components/sales/whatsapp-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
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
  const [clientes, cotizaciones, ordenes, cotizacionesUnificadas] = await Promise.all([
    getClientesRows(),
    getCotizacionesRows(),
    getOrdenesProduccionRows(),
    getCotizacionesUnificadasRows(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);
  const clientesById = new Map(clientes.map((c) => [c.id, c.nombre]));
  const cotizacionesById = new Map(cotizaciones.map((c) => [c.id, c]));
  const cotizUnificadasById = new Map(
    cotizacionesUnificadas.map((c) => [c.id, c]),
  );

  const cotizacionesPersonalizadas = cotizaciones.filter(
    (c) => c.tipo === "mueble_personalizado",
  );
  const aprobables = cotizacionesPersonalizadas.filter((c) => c.estado === "confirmada");

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
            <>
              <ContextActionPanel
                triggerLabel="Nueva cotización"
                title="Cotización personalizada"
                description="Cliente, especie, precio calculado y precio acordado."
              >
                <form action={createCotizacion} className="grid gap-3 md:grid-cols-2">
                  <SelectField name="cliente_id" label="Cliente" defaultValue="" required>
                    <option value="" disabled>
                      Selecciona cliente
                    </option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                      </option>
                    ))}
                  </SelectField>
                  <Field name="fecha" type="date" label="Fecha" required />
                  <input type="hidden" name="tipo" value="mueble_personalizado" />
                  <Field
                    name="especie_madera"
                    label="Especie de madera"
                    placeholder="Tornillo / Pino / Cedro"
                    required
                  />
                  <SelectField name="unidad_medida" label="Unidad base" defaultValue="cm">
                    <option value="cm">Centímetros</option>
                    <option value="in">Pulgadas</option>
                    <option value="otro">Otra</option>
                  </SelectField>
                  <Field
                    name="precio_calculado"
                    label="Precio calculado (S/)"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                  <Field
                    name="precio_acordado"
                    label="Precio acordado (S/)"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                  <SelectField name="estado" label="Estado" defaultValue="confirmada">
                    <option value="borrador">Borrador</option>
                    <option value="confirmada">Confirmada</option>
                  </SelectField>
                  <div className="md:col-span-2">
                    <NotasSelector name="motivo_ajuste" label="Notas para incluir en la cotización" />
                  </div>
                  <div className="md:col-span-2">
                    <Button>Guardar cotización</Button>
                  </div>
                </form>
              </ContextActionPanel>

              <ContextActionPanel
                triggerLabel="Aceptar (orden + adelanto)"
                title="Aceptar cotización confirmada"
                description="En un solo paso: crea la orden de producción y registra el adelanto en caja."
              >
                <form action={voidFormAction(aprobarCotizacionAOrden)} className="grid gap-3">
                  <SelectField name="cotizacion_id" label="Cotización" defaultValue="" required>
                    <option value="" disabled>
                      Selecciona cotización
                    </option>
                    {aprobables.map((c) => (
                      <option key={c.id} value={c.id}>
                        {`${c.correlativo ?? formatDate(c.fecha)} · ${clientesById.get(c.cliente_id) ?? "Cliente"} · ${formatPen(Number(c.precio_acordado))}`}
                      </option>
                    ))}
                  </SelectField>
                  <Field
                    name="notas"
                    label="Notas para el taller"
                    placeholder="Acabado, materiales, fechas estimadas…"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      name="adelanto"
                      label="Adelanto cobrado (S/) — opcional"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                    />
                    <SelectField name="metodo_adelanto" label="Medio del adelanto" defaultValue="efectivo">
                      <option value="efectivo">Efectivo</option>
                      <option value="yape">Yape</option>
                      <option value="banco">Banco</option>
                      <option value="otro">Otro</option>
                    </SelectField>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Si dejas el adelanto en 0, solo se crea la orden. Si pones un monto &gt; 0, se
                    asienta como ingreso en caja con la categoría
                    <strong> adelanto_mueble_personalizado</strong>.
                  </p>
                  <Button>Aceptar cotización</Button>
                </form>
              </ContextActionPanel>
            </>
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
                </TRow>
              );
              })}
              {cotizacionesPersonalizadas.length === 0 ? (
                <TRow>
                  <TD colSpan={8} className="text-center text-[var(--color-text-secondary)]">
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
            action={voidFormAction(cambiarEstadoOrden)}
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
