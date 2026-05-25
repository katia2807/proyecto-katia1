"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DetailDrawer, DetailField } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatDate, formatPen } from "@/lib/utils";
import { parseCotizacionDetalle } from "@/lib/cotizacion-unificada-payload";
import { cambiarEstadoCotizacion } from "@/app/actions";

type Cotizacion = {
  id: string;
  cliente: string;
  fecha: string;
  correlativo: string | null;
  total: number;
  estado_flujo: string;
  tipo_cliente: string;
  detalle: unknown;
  created_at: string;
};

function EstadoBadge({ estado }: { estado: string }) {
  const colores: Record<string, string> = {
    pendiente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    lista_produccion: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    en_produccion: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    cobrada: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    terminado: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    entregado: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
    inactivo: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
    deudor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    lista_produccion: "Lista para producción",
    en_produccion: "En producción",
    cobrada: "Cobrada",
    terminado: "Terminado",
    entregado: "Entregado",
    inactivo: "Inactivo",
    deudor: "Deudor (Mora)",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${colores[estado] ?? "bg-gray-100 text-gray-700"}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

function DetalleVisual({ detalle }: { detalle: unknown }) {
  const d = useMemo(() => parseCotizacionDetalle(detalle), [detalle]);

  const metodoLabel: Record<string, string> = {
    efectivo: "Efectivo",
    yape: "Yape / Plin",
    transferencia: "Transferencia bancaria",
    billetera_digital: "Billetera digital",
    otro: "Otro",
  };

  const modalidadLabel: Record<string, string> = {
    contado: "Contado",
    adelanto: "Adelanto",
    adelanto_saldo: "Adelanto + saldo",
    credito: "Crédito",
  };

  // Extraer info de pago de notas_generales si fue guardada ahí
  const notasLineas = (d.notas_generales ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const notasPago = notasLineas.filter((l) =>
    l.startsWith("Modalidad:") || l.startsWith("Monto adelantado:") ||
    l.startsWith("Saldo pendiente:") || l.startsWith("Plazo")
  );
  const notasCliente = notasLineas.filter((l) => !notasPago.includes(l));

  return (
    <div className="space-y-4 text-sm">

      {/* ── RUBROS ACTIVOS ── */}
      <section>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Rubros
        </p>
        <div className="flex flex-wrap gap-2">
          {d.rubros.muebles && (
            <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold">
              Muebles personalizados
            </span>
          )}
          {d.rubros.aserradero && (
            <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold">
              Aserradero / Mano de obra
            </span>
          )}
          {d.rubros.alquiler && (
            <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold">
              Alquiler de maquinaria
            </span>
          )}
        </div>
      </section>

      {/* ── MUEBLES ── */}
      {d.rubros.muebles && d.muebles_lineas.length > 0 && (
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Muebles — piezas y madera
          </p>
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            {d.muebles_lineas.map((linea, li) => {
              const totalPt = linea.piezas.reduce(
                (acc, p) => acc + (p.cantidad * p.espesor * p.ancho * p.largo) / 12,
                0,
              );
              const ptCompra = totalPt * (1 + d.desperdicioPctMuebles / 100);
              const montoLinea = ptCompra * linea.precioPorPt;
              return (
                <div key={linea.id} className="space-y-2">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    Línea {li + 1}{linea.especie_label ? ` · ${linea.especie_label}` : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                    <span>Volumen de Madera (PT): <strong className="text-[var(--color-text-primary)]">{ptCompra.toFixed(2)} PT</strong></span>
                    <span>Precio por Pie: <strong className="text-[var(--color-text-primary)]">{formatPen(linea.precioPorPt)}</strong></span>
                    <span className="col-span-2">Subtotal línea: <strong className="text-[var(--color-text-primary)]">{formatPen(montoLinea)}</strong></span>
                  </div>
                  {linea.piezas.length > 0 && (
                    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-[var(--color-primary-soft)]/30">
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold">Pieza</th>
                            <th className="px-2 py-1 text-center font-semibold">Cant.</th>
                            <th className="px-2 py-1 text-center font-semibold">Esp.</th>
                            <th className="px-2 py-1 text-center font-semibold">Ancho</th>
                            <th className="px-2 py-1 text-center font-semibold">Largo</th>
                            <th className="px-2 py-1 text-right font-semibold">PT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linea.piezas.map((p, pi) => {
                            const pt = (p.cantidad * p.espesor * p.ancho * p.largo) / 12;
                            return (
                              <tr key={p.id} className={pi % 2 === 0 ? "" : "bg-[var(--color-primary-soft)]/10"}>
                                <td className="px-2 py-1">{p.descripcion || `Pieza ${pi + 1}`}</td>
                                <td className="px-2 py-1 text-center">{p.cantidad}</td>
                                <td className="px-2 py-1 text-center">{p.espesor}{"\""}</td>
                                <td className="px-2 py-1 text-center">{p.ancho}{"\""}</td>
                                <td className="px-2 py-1 text-center">{p.largo}{"'"}</td>
                                <td className="px-2 py-1 text-right font-semibold">{pt.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {d.costoAcabadoSoles > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Acabado: <strong className="text-[var(--color-text-primary)]">{formatPen(d.costoAcabadoSoles)}</strong>
              </p>
            )}
            {d.costoManoObra > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Mano de obra: <strong className="text-[var(--color-text-primary)]">{formatPen(d.costoManoObra)}</strong>
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── ASERRADERO ── */}
      {d.rubros.aserradero && d.aserradero && (
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Aserradero / Mano de obra
          </p>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1 text-xs">
            <p>Modo: <strong>{d.aserradero.modo === "hora" ? "Por tiempo" : "Monto fijo"}</strong></p>
            {d.aserradero.modo === "hora" ? (
              <>
                <p>S/ por hora: <strong>{formatPen(d.aserradero.precioHora)}</strong></p>
                <p>Horas: <strong>{d.aserradero.horas}</strong></p>
                <p>Total: <strong>{formatPen(d.aserradero.precioHora * d.aserradero.horas)}</strong></p>
              </>
            ) : (
              <p>Monto acordado: <strong>{formatPen(d.aserradero.montoTotalFijo)}</strong></p>
            )}
            {d.aserradero.descripcion && (
              <p className="pt-1 text-[var(--color-text-secondary)]">{d.aserradero.descripcion}</p>
            )}
          </div>
        </section>
      )}

      {/* ── ALQUILER ── */}
      {d.rubros.alquiler && d.alquiler && (
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Alquiler de maquinaria
          </p>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1 text-xs">
            <p>Equipo: <strong>{d.alquiler.nombre_maquinaria || "—"}</strong></p>
            <p>Tarifa: <strong>{formatPen(d.alquiler.tarifa)} / {d.alquiler.tarifaUnidad === "hora" ? "hora" : "día"}</strong></p>
            <p>Tiempo: <strong>{d.alquiler.unidades_tiempo} {d.alquiler.tarifaUnidad === "hora" ? "h" : "día(s)"}</strong></p>
            <p>Subtotal: <strong>{formatPen(d.alquiler.tarifa * d.alquiler.unidades_tiempo)}</strong></p>
            {d.alquiler.incluye_garantia_danios && d.alquiler.monto_garantia > 0 && (
              <p>Garantía: <strong>{formatPen(d.alquiler.monto_garantia)}</strong></p>
            )}
            {d.alquiler.notas && (
              <p className="pt-1 text-[var(--color-text-secondary)]">{d.alquiler.notas}</p>
            )}
          </div>
        </section>
      )}

      {/* ── CONDICIONES DE PAGO (desde notas) ── */}
      {notasPago.length > 0 && (
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Condiciones de pago
          </p>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3 space-y-1">
            {notasPago.map((l, i) => (
              <p key={i} className="text-xs font-medium text-[var(--color-text-primary)]">{l}</p>
            ))}
          </div>
        </section>
      )}

      {/* ── DESCRIPCIÓN PARA EL CLIENTE ── */}
      {(d as { descripcion_cliente?: string }).descripcion_cliente?.trim() && (
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Descripción para el cliente
          </p>
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-primary)]">
            {(d as { descripcion_cliente?: string }).descripcion_cliente}
          </p>
        </section>
      )}

      {/* ── NOTAS ADICIONALES ── */}
      {notasCliente.length > 0 && (
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Notas adicionales
          </p>
          <ul className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1 list-disc list-inside">
            {notasCliente.map((n, i) => (
              <li key={i} className="text-xs text-[var(--color-text-primary)]">{n}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── FIX: helper robusto para parsear el total que llega de Supabase ──────────
// Supabase puede devolver el campo `total` como string, number o null.
// Number() falla con strings vacíos o valores inesperados; parseFloat + fallback
// garantiza que siempre tengamos un número válido.
function parseTotalSeguro(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function CotizacionMasterDetail({
  cotizaciones,
  canMutate,
}: {
  cotizaciones: Cotizacion[];
  canMutate: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("cotizacion");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialId && cotizaciones.some((row) => row.id === initialId) ? initialId : null,
  );
  const selected = useMemo(() => cotizaciones.find((row) => row.id === selectedId) ?? null, [cotizaciones, selectedId]);

  const [selectedEstado, setSelectedEstado] = useState<string>("pendiente");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (selected) {
      setSelectedEstado(selected.estado_flujo);
    }
  }, [selected]);

  const handleSaveEstado = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (["entregado", "inactivo"].includes(selectedEstado)) {
      const labelNuevo = selectedEstado === "entregado" ? "Entregado" : "Inactivo";
      const ok = window.confirm(`¿Estás seguro de cambiar el estado a "${labelNuevo}"? Esta acción es irreversible.`);
      if (!ok) return;
    }
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await cambiarEstadoCotizacion(formData);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error al cambiar el estado");
      }
    });
  };

  if (cotizaciones.length === 0) {
    return (
      <EmptyState
        title="Aun no hay cotizaciones"
        description="Las cotizaciones ordenan cliente, items, precios, fechas, cobros y produccion."
        actionLabel="Crear cotizacion"
        actionHref="/cotizacion#cotizacion-wizard"
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <Table>
          <THead>
            <TRow>
              <TH>Nro.</TH>
              <TH>Fecha</TH>
              <TH>Cliente</TH>
              <TH>Estado</TH>
              {/* FIX: usamos parseTotalSeguro en lugar de Number() directo */}
              <TH className="text-right">Total</TH>
            </TRow>
          </THead>
          <tbody>
            {cotizaciones.map((row) => (
              <TRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <TD className="font-mono text-xs">{row.correlativo ?? row.id.slice(0, 8)}</TD>
                <TD>{formatDate(row.fecha)}</TD>
                <TD>{row.cliente}</TD>
                <TD><EstadoBadge estado={row.estado_flujo} /></TD>
                <TD className="text-right font-semibold">{formatPen(parseTotalSeguro(row.total))}</TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        title={selected?.correlativo ?? "Cotizacion"}
        description="Detalle completo de cotizacion"
        fullPageHref={selected ? `/cotizacion?cotizacion=${selected.id}` : undefined}
        onClose={() => {
          setSelectedId(null);
        }}
        onEdit={() => {
          if (selected) {
            setSelectedId(null);
            router.push(`/cotizacion?editar=${selected.id}`);
          }
        }}
      >
        {selected ? (
          <div className="space-y-4">
            {/* Datos principales */}
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Cliente" value={selected.cliente} />
              <DetailField label="Fecha" value={formatDate(selected.fecha)} />
              <DetailField label="Tipo cliente" value={selected.tipo_cliente === "empresa" ? "Empresa" : "Persona natural"} />
              {/* FIX: mismo helper para el drawer */}
              <DetailField label="Total" value={formatPen(parseTotalSeguro(selected.total))} />
              <div className="col-span-2 space-y-1">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Estado</p>
                <EstadoBadge estado={selected.estado_flujo} />
              </div>

              {canMutate && (
                <form
                  onSubmit={handleSaveEstado}
                  action={cambiarEstadoCotizacion}
                  className="col-span-2 mt-2 border-t border-[var(--color-border)] pt-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Cambiar estado</p>
                  <div className="flex items-center gap-2">
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="nuevo_estado" value={selectedEstado} />
                    <select
                      value={selectedEstado}
                      onChange={(e) => setSelectedEstado(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
                      disabled={isPending}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="lista_produccion">Lista para producción</option>
                      <option value="en_produccion">En producción</option>
                      <option value="terminado">Terminado</option>
                      <option value="entregado">Entregado</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="deudor">Deudor (Mora)</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                    >
                      {isPending ? "Guardando..." : "Guardar estado"}
                    </button>
                  </div>
                </form>
              )}
              <DetailField label="Creada" value={formatDate(selected.created_at)} />
            </div>

            {/* Detalle visual legible */}
            <DetalleVisual detalle={selected.detalle} />
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
