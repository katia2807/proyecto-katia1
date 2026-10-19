import { getClienteEliminacion, type ClienteEliminacion } from "@/lib/cliente-eliminacion";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { getDashboardSession } from "@/lib/current-user-role";
import { getAuthContext } from "@/lib/auth";
import { getClientesRows } from "@/lib/data";
import { canAccessGerencial, canMutateVentas } from "@/lib/permissions";
import { deleteCliente, forzarEliminarClienteCompleto } from "@/app/actions";
import { formatDate, formatPen } from "@/lib/utils";
import { GerencialClienteSearchSelect } from "@/components/gerencial/cliente-search-select";
import { ClienteEstadoForm } from "@/components/gerencial/cliente-estado-form";
import { documentoCliente, etiquetaTipoCliente, etiquetaEstadoCliente } from "@/lib/clientes-model";
import { getClienteHistorial, resumenClientes, cobrosClientes, type ClienteResumen } from "@/lib/clientes-data";
import { ClientesMasivoTable } from "@/components/gerencial/clientes-masivo-table";
import type { ClienteCompleto } from "@/lib/combobox-mocks";
import { CentroMandoTabs } from "@/components/gerencial/centro-mando-tabs";
import { DecisionPanel } from "@/components/gerencial/decision-panel";
import { getGerencialSources, normalizeGerencialTab, type GerencialTab } from "@/lib/gerencial-data";
import { buildGerencialModel } from "@/lib/gerencial-model";

export const dynamic = "force-dynamic";
type GerencialPageProps = {
  searchParams?: Promise<{ cliente?: string | string[]; mensaje?: string | string[]; resultado?: string | string[]; tab?: string | string[]; alertas?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function GerencialPage({ searchParams }: GerencialPageProps) {
  const params = await searchParams;
  const session = await getDashboardSession();
  if (!canAccessGerencial(session?.role ?? null, session?.uiRole ?? null)) redirect("/?mensaje=no-acceso");
  const activeTab = normalizeGerencialTab(firstParam(params?.tab), firstParam(params?.alertas));
  const [clientes, historialClientes] = activeTab === "clientes360" ? await Promise.all([getClientesRows(), getClienteHistorial()]) : [[], null];
  const context = await getAuthContext();
  const model = ["hoy", "pasado", "futuro"].includes(activeTab) ? buildGerencialModel(await getGerencialSources(activeTab as GerencialTab, context?.organizationId)) : null;

  // Datos "Clientes 360"
  const clientesCompleto: ClienteCompleto[] = clientes.map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    documento: cliente.documento ?? null,
    telefono: (cliente as Record<string, unknown>).telefono as string | null ?? null,
    direccion: (cliente as Record<string, unknown>).direccion as string | null ?? null,
    ruc: (cliente as Record<string, unknown>).ruc as string | null ?? null,
  }));

  // Para la tabla masiva de clientes
  const resumenPorCliente = historialClientes ? resumenClientes(historialClientes) : new Map<string, ClienteResumen>();
  const clientesMasivo = clientes.map((cliente) => {
    const resumen = resumenPorCliente.get(cliente.id);
    return {
      id: cliente.id,
      nombre: cliente.nombre,
      documento: documentoCliente(cliente),
      telefono: (cliente as Record<string, unknown>).telefono as string | null ?? null,
      estado: (cliente as Record<string, unknown>).estado as string | null ?? null,
      tipo_persona: (cliente as Record<string, unknown>).tipo_persona as string | null ?? null,
      totalFacturado: resumen?.total ?? 0,
      importesPorDefinir: resumen?.importesPorDefinir ?? 0,
      totalOperaciones: resumen?.operaciones ?? 0,
      cobrosVencidos: resumen?.cobrosVencidos ?? 0,
    };
  });

  const message = firstParam(params?.mensaje).trim();
  const resultado = firstParam(params?.resultado);
  const selectedClienteId = firstParam(params?.cliente).trim();
  const selectedCliente = selectedClienteId ? clientes.find((c) => c.id === selectedClienteId) ?? null : null;
  const porCliente = <T extends { cliente_id: string | null }>(rows: T[]) => selectedCliente ? rows.filter(c => c.cliente_id === selectedCliente.id) : [];
  const clienteCobrosVencidos = porCliente(historialClientes ? cobrosClientes(historialClientes) : []);
  const resumenCliente = selectedCliente ? resumenPorCliente.get(selectedCliente.id) : null;
  const totalFacturadoCliente = resumenCliente?.total ?? 0;
  const totalOperacionesCliente = resumenCliente?.operaciones ?? 0;
  const canManage = canMutateVentas(session?.role, session?.uiRole);
  let eliminacion: ClienteEliminacion | null = null;
  let eliminacionError = "";
  if (selectedCliente) {
    try {
      eliminacion = await getClienteEliminacion(selectedCliente.id, context?.organizationId);
      if (!eliminacion) eliminacionError = "El cliente ya no está disponible. Actualiza la página.";
    } catch {
      eliminacionError = "No pudimos comprobar los registros vinculados. Actualiza la página para volver a intentarlo.";
    }
  }
  const hasRelatedDependencies = (eliminacion?.dependencias.length ?? 0) > 0;
  const pedidosActivosCliente = resumenCliente?.pedidosActivos ?? 0;
  const pagosPendientesCliente = selectedCliente ? clienteCobrosVencidos.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">
          Centro de Mando
        </h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Prioridades, resultados y próximos compromisos para decidir con información registrada.
        </p>
      </div>

      {message ? (
        <div role={resultado === "error" ? "alert" : "status"} className={"rounded-[var(--katia-radius-md)] border px-4 py-3 text-sm font-medium " + (
          resultado === "error" ? "border-[var(--katia-danger)]/40 bg-[var(--katia-danger)]/10 text-[var(--katia-danger)]" :
          resultado === "exito" ? "border-[var(--katia-success)]/40 bg-[var(--katia-success)]/10 text-[var(--katia-success)]" :
          "border-[var(--katia-border-default)] bg-[var(--katia-bg-overlay)] text-[var(--katia-text-primary)]"
        )}>
          {resultado === "exito" ? "✓ " : ""}{message}
        </div>
      ) : null}

      {/* Sub-tabs navegables */}
      <CentroMandoTabs activeTab={activeTab} />

      {model ? <DecisionPanel model={model} tab={activeTab as GerencialTab} /> : null}

      {/* ── CLIENTES 360 ── */}
      {activeTab === "clientes360" ? (
        <div className="space-y-6">
          {/* Tabla masiva de todos los clientes */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Gestión masiva de clientes</CardTitle>
                <CardDescription>
                  Todos los clientes con su historial, estado y acciones directas.
                  Selecciona uno para ver la ficha detallada.
                </CardDescription>
              </div>
              <Link href="/ventas/clientes">
                <button type="button" className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--katia-text-secondary)] hover:bg-[var(--katia-surface-raised)] transition-colors">
                  + Nuevo cliente
                </button>
              </Link>
            </div>
            <div className="mt-4">
              <ClientesMasivoTable
                clientes={clientesMasivo}
                canManage={canManage}
              />
            </div>
          </Card>

          {/* Ficha detallada de cliente seleccionado (via search select) */}
          <Card>
            <CardTitle>Ficha detallada — búsqueda rápida</CardTitle>
            <CardDescription>
              Busca un cliente específico para ver su resumen completo, cambiar estado o eliminarlo.
            </CardDescription>
            <div className="mt-4">
              <GerencialClienteSearchSelect
                clientes={clientesCompleto}
                value={selectedClienteId}
              />
            </div>
          </Card>

          {selectedCliente ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--katia-text-primary)]">{selectedCliente.nombre}</h3>
                  <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
                    {etiquetaTipoCliente(selectedCliente.tipo_persona)} · {documentoCliente(selectedCliente)}
                  </p>
                </div>
                <Link href={`/ventas/clientes/${selectedCliente.id}`}>
                  <Button variant="secondary" size="sm" type="button">Ver ficha completa →</Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--katia-text-tertiary)]">Desde</p>
                  <p className="mt-1 text-sm text-[var(--katia-text-primary)]">{formatDate(selectedCliente.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--katia-text-tertiary)]">Estado</p>
                  <p className="mt-1 text-sm text-[var(--katia-text-primary)]">{etiquetaEstadoCliente(selectedCliente.estado)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--katia-text-tertiary)]">Avisos de vencimiento (muebles y alquileres)</p>
                  <p className={`mt-1 text-sm font-semibold ${pagosPendientesCliente > 0 ? "text-[var(--katia-danger)]" : "text-[var(--katia-text-primary)]"}`}>
                    {pagosPendientesCliente}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardTitle>Total registrado</CardTitle>
                  <p className="mt-1 font-mono text-2xl font-bold text-[var(--katia-text-primary)]">{formatPen(totalFacturadoCliente)}</p>
                  <p className="mt-2 text-xs text-[var(--katia-text-tertiary)]">Importes de ventas confirmadas y servicios registrados; las propuestas pendientes no se suman.</p>
                  {(resumenCliente?.importesPorDefinir ?? 0) > 0 ? <p className="mt-1 text-xs text-[var(--katia-text-tertiary)]">{resumenCliente?.importesPorDefinir} importe(s) por definir.</p> : null}
                </Card>
                <Card>
                  <CardTitle>Operaciones</CardTitle>
                  <p className="mt-1 text-2xl font-bold text-[var(--katia-text-primary)]">{totalOperacionesCliente}</p>
                </Card>
                <Card>
                  <CardTitle>Pedidos activos</CardTitle>
                  <p className="mt-1 text-2xl font-bold text-[var(--katia-text-primary)]">{pedidosActivosCliente}</p>
                </Card>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-bg-overlay)] p-4">
                  <p className="text-sm font-semibold text-[var(--katia-text-primary)]">Datos de contacto</p>
                  <div className="mt-3 space-y-2 text-sm text-[var(--katia-text-secondary)]">
                    <p>Teléfono: {selectedCliente.telefono ?? "Sin teléfono"}</p>
                    <p>Dirección: {selectedCliente.direccion ?? "Sin dirección"}</p>
                    <p>Tipo: {etiquetaTipoCliente(selectedCliente.tipo_persona)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Card id="estado-cliente">
                    <CardTitle>Actualizar estado</CardTitle>
                    <CardDescription>Cambia el estado del cliente.</CardDescription>
                    <ClienteEstadoForm
                      key={`${selectedCliente.id}:${selectedCliente.estado ?? ""}`}
                      clienteId={selectedCliente.id}
                      estadoActual={selectedCliente.estado ?? null}
                    />
                  </Card>
                </div>
              </div>

              <div id="eliminar-cliente" className="mt-6 scroll-mt-24 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] bg-[var(--katia-bg-overlay)] p-4">
                <h4 className="text-sm font-semibold">Eliminar cliente</h4>
                <p className="mt-2 text-sm text-[var(--katia-text-secondary)]">
                  Solo se elimina la ficha cuando no tiene registros vinculados. Para conservar su historial, puedes usar el estado Inactivo.
                </p>
                <div id="motivo-eliminacion" className="mt-3 space-y-2 text-sm">
                  {eliminacionError ? <p role="alert" className="text-[var(--katia-danger)]">{eliminacionError}</p> : null}
                  {!canManage ? <p>Tu cuenta no tiene permiso para eliminar clientes. Solicita la revisión de la dueña o de gerencia.</p> : null}
                  {eliminacion?.estado === "activo" ? (
                    <p>El cliente está <strong>Activo</strong>. Primero elige <strong>Inactivo</strong> en «Actualizar estado» y pulsa «Guardar estado».</p>
                  ) : null}
                  {hasRelatedDependencies ? (
                    <>
                      <p className="font-medium">No se puede eliminar porque tiene registros vinculados:</p>
                      <ul className="list-inside list-disc space-y-1">
                        {eliminacion?.dependencias.map(dep => <li key={dep.label}>
                          <Link href={dep.href} className="underline">{dep.label}: {dep.count}</Link>
                        </li>)}
                      </ul>
                      <p>Marcarlo como Inactivo conserva estos registros. No necesitas borrar ventas o cobros para dejar de usar su ficha.</p>
                    </>
                  ) : null}
                </div>
                {canManage && eliminacion?.puedeEliminar && !eliminacionError ? (
                  <form action={deleteCliente} className="mt-4 grid max-w-lg gap-3">
                    <p className="text-sm">Se eliminará únicamente la ficha de <strong>{selectedCliente.nombre}</strong>. Esta acción no se puede deshacer desde el programa.</p>
                    <input type="hidden" name="id" value={selectedCliente.id} />
                    <Field label="Escribe ELIMINAR CLIENTE para confirmar" name="confirmacion" placeholder="ELIMINAR CLIENTE" autoComplete="off" required />
                    <PendingSubmitButton idleText="Eliminar cliente" pendingText="Eliminando..." variant="danger" />
                  </form>
                ) : (
                  <Button type="button" variant="secondary" size="sm" disabled aria-describedby="motivo-eliminacion" className="mt-4">Eliminar cliente</Button>
                )}
                {canManage && session?.role === "owner_admin" && selectedCliente.estado !== "activo" && hasRelatedDependencies ? (
                  <details className="mt-5 border-t border-[var(--katia-border-subtle)] pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--katia-danger)]">
                      Eliminación completa de ficha e historial · solo dueña
                    </summary>
                    <p className="mt-3 text-sm text-[var(--katia-danger)]">
                      Esta opción elimina también las operaciones del cliente y puede anular cobros y devolver existencias. Si vas a conservar las operaciones, mantén la ficha como Inactivo.
                    </p>
                    <form action={forzarEliminarClienteCompleto} className="mt-3 grid max-w-lg gap-3">
                      <input type="hidden" name="id" value={selectedCliente.id} />
                      <Field label="Escribe ELIMINAR TODO para confirmar" name="confirmacion" placeholder="ELIMINAR TODO" autoComplete="off" required />
                      <PendingSubmitButton idleText="Eliminar cliente y todos sus registros" pendingText="Eliminando registros..." variant="danger" />
                    </form>
                  </details>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* ── HERRAMIENTAS ── */}
      {activeTab === "herramientas" ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Herramientas rápidas</CardTitle>
            <CardDescription>Accesos a las pantallas habituales del programa.</CardDescription>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Link href="/ventas">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Nueva venta directa</CardTitle>
                  <CardDescription className="mt-1">Abrir Ventas y elegir el tipo de operación.</CardDescription>
                </Card>
              </Link>
              <Link href="/cotizacion">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Nueva cotización</CardTitle>
                  <CardDescription className="mt-1">Crear cotización con líneas de productos.</CardDescription>
                </Card>
              </Link>
              <Link href="/inventario">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Ajuste de stock</CardTitle>
                  <CardDescription className="mt-1">Registrar entrada o salida de inventario.</CardDescription>
                </Card>
              </Link>
              <Link href="/caja">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Movimiento de caja</CardTitle>
                  <CardDescription className="mt-1">Registrar ingreso o egreso en caja.</CardDescription>
                </Card>
              </Link>
              <Link href="/reportes">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Reportes y exportes</CardTitle>
                  <CardDescription className="mt-1">Exportar data a Excel para análisis.</CardDescription>
                </Card>
              </Link>
              <Link href="/admin/respaldo">
                <Card className="cursor-pointer hover:border-[var(--katia-border-emphasis)]">
                  <CardTitle>Respaldo de datos</CardTitle>
                  <CardDescription className="mt-1">Descargar respaldo manual de la base de datos.</CardDescription>
                </Card>
              </Link>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
