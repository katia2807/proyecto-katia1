"use client";

import { submitCreateServicioAserraderoForm } from "@/app/actions";
import { useMemo, useState, useActionState, useEffect } from "react";
import { CubicajeInput } from "@/components/sales/cubicaje-input";
import { MargenIndicator } from "@/components/sales/margen-indicator";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import { liteClientesToCompleto } from "@/lib/combobox-mocks";
import { formatPen } from "@/lib/utils";

type Cliente = { id: string; nombre: string };
type ServicioEspecial = {
  id: string;
  codigo: string;
  nombre: string;
  tarifa_por_pieza: number;
};

type AserraderoFormProps = {
  clientes: Cliente[];
  serviciosEspeciales: ServicioEspecial[];
  /** Costo en S/ por pie cúbico para cubicaje base. */
  defaultCostoPorPieCubico?: number;
  /** Lista mock para ClienteCombobox sin Supabase. */
  mockData?: boolean;
  onSuccess?: () => void;
};

const PIE_TABLAR_A_PIE_CUBICO = 1 / 12;

/** Misma pieza por defecto que `CubicajeInput` (1×2×6×8 → 8 PT) para que `pies_cubicos` no quede en 0 al enviar sin tocar la tabla. */
const DEFAULT_LINEAS_CUBICAJE_JSON = JSON.stringify([
  { id: 1, cantidad: 1, espesor: 2, ancho: 6, largo: 8, descripcion: "", subtotalPT: 8 },
]);

export function AserraderoForm({
  clientes,
  serviciosEspeciales,
  defaultCostoPorPieCubico = 0.5,
  mockData = false,
  onSuccess,
}: AserraderoFormProps) {
  const { showToast } = useToast();
  const hoy = new Date().toISOString().slice(0, 10);
  const [clienteId, setClienteId] = useState("");
  const [clientesLocales, setClientesLocales] = useState<{ id: string; nombre: string }[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");
  const [costoPorPieCubico, setCostoPorPieCubico] = useState(defaultCostoPorPieCubico);
  const [piezasJson, setPiezasJson] = useState<string>(DEFAULT_LINEAS_CUBICAJE_JSON);

  const [state, formAction] = useActionState(submitCreateServicioAserraderoForm, mutationFormInitialState);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onSuccess?.();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onSuccess]);

  const [seleccionados, setSeleccionados] = useState<Record<string, { activo: boolean; cantidad: number; tarifa: number }>>(
    Object.fromEntries(
      serviciosEspeciales.map((s) => [s.id, { activo: false, cantidad: 1, tarifa: s.tarifa_por_pieza }]),
    ),
  );

  const piezas = useMemo(() => {
    try {
      const arr = JSON.parse(piezasJson);
      return Array.isArray(arr) ? (arr as { subtotalPT?: number }[]) : [];
    } catch {
      return [];
    }
  }, [piezasJson]);

  const totalPT = useMemo(
    () => piezas.reduce((acc, p) => acc + (Number(p.subtotalPT) || 0), 0),
    [piezas],
  );
  const piesCubicos = useMemo(() => totalPT * PIE_TABLAR_A_PIE_CUBICO, [totalPT]);
  const costoCubicaje = useMemo(
    () => piesCubicos * costoPorPieCubico,
    [piesCubicos, costoPorPieCubico],
  );

  const totalServiciosEspeciales = useMemo(() => {
    return Object.entries(seleccionados).reduce((acc, [, val]) => {
      if (!val.activo) return acc;
      return acc + val.cantidad * val.tarifa;
    }, 0);
  }, [seleccionados]);

  const precioCobrado = costoCubicaje + totalServiciosEspeciales;
  const utilidad = precioCobrado - costoCubicaje;

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);
  const clientesCombo = useMemo(() => liteClientesToCompleto(todosLosClientes), [todosLosClientes]);

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  const lineasPayload = useMemo(
    () =>
      Object.entries(seleccionados)
        .filter(([, v]) => v.activo)
        .map(([id, v]) => {
          const servicio = serviciosEspeciales.find((s) => s.id === id);
          return {
            id,
            codigo: servicio?.codigo ?? id,
            nombre: servicio?.nombre ?? id,
            cantidad: v.cantidad,
            tarifa: v.tarifa,
            subtotal: Number((v.cantidad * v.tarifa).toFixed(2)),
          };
        }),
    [seleccionados, serviciosEspeciales],
  );

  return (
    <form
      action={formAction}
      className="space-y-4"
      onChange={(e) => {
        const target = e.target as unknown as HTMLInputElement;
        if (target && target.name === "lineas_cubicaje") {
          setPiezasJson(target.value);
        }
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {/* ── CLIENTE ── */}
        <div className="space-y-2">
          {modoCliente === "buscar" ? (
            <>
              <ClienteCombobox
                mockData={mockData}
                clientes={clientesCombo}
                value={clienteId}
                onChange={setClienteId}
                hiddenInputName="cliente_id"
                label="Cliente"
                placeholder="Buscar cliente…"
                inputAriaLabel="Cliente para servicio de aserradero"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoCliente("nuevo")}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  + Nuevo cliente
                </button>
                <span className="text-xs text-[var(--color-text-secondary)]">·</span>
                <button
                  type="button"
                  onClick={() => setModoCliente("temporal")}
                  className="text-xs font-semibold text-[var(--color-text-secondary)] hover:underline"
                >
                  + Cliente temporal
                </button>
              </div>
            </>
          ) : (
            <NuevoClienteInlinePanel
              temporal={modoCliente === "temporal"}
              onCreated={handleClienteCreado}
              onCancel={() => setModoCliente("buscar")}
            />
          )}
        </div>

        <Field name="fecha" type="date" label="Fecha" defaultValue={hoy} required />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Cubicaje rápido (pies tablares y volumen)
        </p>
        <div className="mt-2">
          <CubicajeInput precioEditable={false} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field
            label="Costo por pie cúbico (S/)"
            type="number"
            min="0"
            step="0.01"
            value={costoPorPieCubico}
            onChange={(e) => setCostoPorPieCubico(Number(e.target.value) || 0)}
          />
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="text-xs text-[var(--color-text-secondary)]">Pies cúbicos</p>
            <p className="text-xl font-bold">{piesCubicos.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/40 p-3">
            <p className="text-xs text-[var(--color-text-secondary)]">Costo cubicaje</p>
            <p className="text-2xl font-bold">{formatPen(costoCubicaje)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Servicios especiales (multi-select con tarifa por pieza editable)
        </p>
        <div className="mt-2 space-y-2">
          {serviciosEspeciales.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Aún no hay servicios especiales configurados.
            </p>
          ) : null}
          {serviciosEspeciales.map((servicio) => {
            const estado = seleccionados[servicio.id] ?? {
              activo: false,
              cantidad: 1,
              tarifa: servicio.tarifa_por_pieza,
            };
            return (
              <div
                key={servicio.id}
                className="grid items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 md:grid-cols-[1.5fr_repeat(3,1fr)]"
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={estado.activo}
                    onChange={(e) =>
                      setSeleccionados((prev) => ({
                        ...prev,
                        [servicio.id]: { ...estado, activo: e.target.checked },
                      }))
                    }
                  />
                  <span>
                    <strong>{servicio.codigo}</strong> · {servicio.nombre}
                  </span>
                </label>
                <Field
                  label="Cantidad"
                  type="number"
                  min="0"
                  step="1"
                  value={estado.cantidad}
                  disabled={!estado.activo}
                  onChange={(e) =>
                    setSeleccionados((prev) => ({
                      ...prev,
                      [servicio.id]: { ...estado, cantidad: Number(e.target.value) || 0 },
                    }))
                  }
                />
                <Field
                  label="Tarifa S/"
                  type="number"
                  min="0"
                  step="0.01"
                  value={estado.tarifa}
                  disabled={!estado.activo}
                  onChange={(e) =>
                    setSeleccionados((prev) => ({
                      ...prev,
                      [servicio.id]: { ...estado, tarifa: Number(e.target.value) || 0 },
                    }))
                  }
                />
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-right">
                  <p className="text-[10px] uppercase text-[var(--color-text-secondary)]">Subtotal</p>
                  <p className="text-sm font-bold">
                    {formatPen(estado.activo ? estado.cantidad * estado.tarifa : 0)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] p-3">
          <p className="text-xs uppercase text-[var(--color-text-secondary)]">Costo cubicaje</p>
          <p className="text-xl font-bold">{formatPen(costoCubicaje)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] p-3">
          <p className="text-xs uppercase text-[var(--color-text-secondary)]">Servicios especiales</p>
          <p className="text-xl font-bold">{formatPen(totalServiciosEspeciales)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/40 p-3">
          <p className="text-xs uppercase text-[var(--color-text-secondary)]">Precio cobrado</p>
          <p className="text-2xl font-black">{formatPen(precioCobrado)}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Utilidad: {formatPen(utilidad)}
          </p>
        </div>
      </div>

      <MargenIndicator costo={costoCubicaje} precio={precioCobrado} label="Margen del servicio" />

      <input type="hidden" name="pies_cubicos" value={piesCubicos.toFixed(4)} />
      <input type="hidden" name="costo_cubicaje" value={costoCubicaje.toFixed(2)} />
      <input type="hidden" name="precio_cobrado" value={precioCobrado.toFixed(2)} />
      <input type="hidden" name="lineas_json" value={JSON.stringify(lineasPayload)} />

      <Button size="lg" className="w-full mt-4 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all">
        Registrar servicio
      </Button>
    </form>
  );
}
