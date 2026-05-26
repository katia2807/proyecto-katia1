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
import { formatPen, roundMoney } from "@/lib/utils";

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
  const [clientesLocales, setClientesLocales] = useState<{ id: string; nombre: string; documento?: string; ruc?: string }[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");
  const [tipoComprobante, setTipoComprobante] = useState<"boleta" | "factura">("boleta");
  const [costoPorPieCubico, setCostoPorPieCubico] = useState(defaultCostoPorPieCubico);
  const [piezasJson, setPiezasJson] = useState<string>(DEFAULT_LINEAS_CUBICAJE_JSON);
  const [step, setStep] = useState(1);
  const [precioCobradoManual, setPrecioCobradoManual] = useState<string>(
    "",
  );
  const [costoCubicajeManual, setCostoCubicajeManual] = useState<string>("");

  const [manoDeObra, setManoDeObra] = useState<number>(0);
  const [extrasMadera, setExtrasMadera] = useState<Array<{ id: number; descripcion: string; cantidad: number }>>([]);
  const [notasInternas, setNotasInternas] = useState<string>("");

  // Campos de pago
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [modalidadPago, setModalidadPago] = useState("contado");
  const [adelanto, setAdelanto] = useState("");
  const [fechaPagoCredito, setFechaPagoCredito] = useState("");

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
      return Array.isArray(arr)
        ? (arr as {
            id?: number;
            cantidad?: number;
            espesor?: number;
            ancho?: number;
            largo?: number;
            descripcion?: string;
            subtotalPT?: number;
          }[])
        : [];
    } catch {
      return [];
    }
  }, [piezasJson]);

  const totalPT = useMemo(
    () => piezas.reduce((acc, p) => acc + (Number(p.subtotalPT) || 0), 0),
    [piezas],
  );
  const piesCubicos = useMemo(() => totalPT * PIE_TABLAR_A_PIE_CUBICO, [totalPT]);
  const selectedCliente = useMemo(() => {
    const all = [...clientes, ...clientesLocales];
    return all.find((c) => c.id === clienteId);
  }, [clienteId, clientes, clientesLocales]);
  const selectedClienteRuc = (selectedCliente as any)?.ruc || "";
  const selectedClienteDoc = (selectedCliente as any)?.documento || "";
  const hasRuc = !!(selectedClienteRuc && selectedClienteRuc.trim().length === 11);

  const hasStep1Warning = !clienteId || (tipoComprobante === "factura" && !hasRuc);
  const hasStep2Warning = piezas.length === 0 || totalPT === 0;

  const costoCubicajeSugerido = useMemo(
    () => roundMoney(piesCubicos * costoPorPieCubico),
    [piesCubicos, costoPorPieCubico],
  );

  const costoCubicaje = (costoCubicajeManual !== "" && !isNaN(Number(costoCubicajeManual)))
    ? roundMoney(Number(costoCubicajeManual))
    : costoCubicajeSugerido;

  const totalServiciosEspeciales = useMemo(() => {
    const sum = Object.entries(seleccionados).reduce((acc, [, val]) => {
      if (!val.activo) return acc;
      return roundMoney(acc + roundMoney(val.cantidad * val.tarifa));
    }, 0);
    return roundMoney(sum);
  }, [seleccionados]);

  const precioCalculado = roundMoney(costoCubicaje + totalServiciosEspeciales + manoDeObra);
  const precioCobrado = (precioCobradoManual !== "" && !isNaN(Number(precioCobradoManual))) ? roundMoney(Number(precioCobradoManual)) : precioCalculado;
  const costoTotalAserradero = roundMoney(costoCubicaje + manoDeObra);
  const utilidad = roundMoney(precioCobrado - costoTotalAserradero);

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);
  const clientesCombo = useMemo(() => liteClientesToCompleto(todosLosClientes), [todosLosClientes]);

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  const lineasPayload = useMemo(
    () => {
      const list = Object.entries(seleccionados)
        .filter(([, v]) => v.activo)
        .map(([id, v]) => {
          const servicio = serviciosEspeciales.find((s) => s.id === id);
          return {
            id,
            tipo: "servicio_especial",
            codigo: servicio?.codigo ?? id,
            nombre: servicio?.nombre ?? id,
            cantidad: v.cantidad,
            tarifa: v.tarifa,
            subtotal: Number((v.cantidad * v.tarifa).toFixed(2)),
          };
        });

      if (manoDeObra > 0) {
        list.push({
          id: "mano-de-obra-aserradero",
          tipo: "mano_de_obra",
          codigo: "MANO-OBRA",
          nombre: "Mano de obra (Aserradero)",
          cantidad: 1,
          tarifa: manoDeObra,
          subtotal: manoDeObra,
        });
      }

      for (const item of extrasMadera) {
        if (item.descripcion.trim()) {
          list.push({
            id: `extra-madera-${item.id}`,
            tipo: "extra_madera_cliente",
            codigo: "EXT-MADERA",
            nombre: `Madera cliente: ${item.descripcion.trim()}`,
            cantidad: item.cantidad,
            tarifa: 0,
            subtotal: 0,
          });
        }
      }

      if (notasInternas.trim()) {
        list.push({
          id: "nota-interna-aserradero",
          tipo: "nota_interna",
          codigo: "NOTA-INT",
          nombre: "Nota interna",
          cantidad: 1,
          tarifa: 0,
          subtotal: 0,
          observaciones: notasInternas.trim(),
        } as any);
      }

      return list;
    },
    [seleccionados, serviciosEspeciales, manoDeObra, extrasMadera, notasInternas],
  );

  function handleSaltarServicios() {
    setSeleccionados((prev) => {
      const reset: Record<string, { activo: boolean; cantidad: number; tarifa: number }> = {};
      for (const [key, val] of Object.entries(prev)) {
        reset[key] = { ...val, activo: false };
      }
      return reset;
    });
    setStep(4);
  }

  return (
    <form
      action={formAction}
      className="space-y-6"
      onChange={(e) => {
        const target = e.target as unknown as HTMLInputElement;
        if (target && target.name === "lineas_cubicaje") {
          setPiezasJson(target.value);
        }
      }}
    >
      {/* ── STEPPER DE WIZARD ── */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { n: 1, label: "Cliente" },
            { n: 2, label: "Cubicaje" },
            { n: 3, label: "Servicios" },
            { n: 4, label: "Resumen" },
            { n: 5, label: "Confirmar" },
          ].map((item, index) => {
            const isCompleted = step > item.n;
            const isActive = step === item.n;
            const hasWarning = (item.n === 1 && hasStep1Warning) || (item.n === 2 && hasStep2Warning);
            return (
              <div
                key={item.n}
                className="flex flex-1 items-center cursor-pointer select-none"
                onClick={() => setStep(item.n)}
              >
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
                      hasWarning
                        ? "border-red-500 bg-red-500/10 text-red-500 shadow-md shadow-red-500/10"
                        : isCompleted
                        ? "bg-[var(--color-success)] border-[var(--color-success)] text-white"
                        : isActive
                        ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20"
                        : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {hasWarning ? "⚠️" : isCompleted ? "✓" : item.n}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-semibold tracking-wide transition-all duration-300 hidden sm:inline ${
                      hasWarning
                        ? "text-red-500 font-bold"
                        : isActive
                        ? "text-[var(--color-primary)] font-bold"
                        : isCompleted
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {index < 4 && (
                  <div
                    className={`h-0.5 w-full -mt-4 transition-all duration-500 ${
                      step > item.n
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-border)]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PASO 1: DATOS DEL CLIENTE ── */}
      <div style={{ display: step === 1 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 1: Datos del cliente y comprobante</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Elige el tipo de comprobante de pago y busca o registra al cliente.
          </p>

          {/* Tipo de Comprobante */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Comprobante *
            </p>
            <div className="flex gap-2">
              {[
                { value: "boleta", label: "Boleta" },
                { value: "factura", label: "Factura" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipoComprobante(opt.value as any)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    tipoComprobante === opt.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="tipo_comprobante" value={tipoComprobante} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
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
                    className={hasStep1Warning ? "[&_input]:!border-red-500/80 [&_input]:focus:!border-red-500 [&_input]:focus:!ring-red-500 [&_input]:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}
                  />
                  {tipoComprobante === "factura" && !hasRuc && clienteId && (
                    <p className="text-xs font-semibold text-red-500 mt-1">
                      ⚠️ El cliente seleccionado no tiene un RUC de 11 dígitos válido.
                    </p>
                  )}
                  {hasStep1Warning && !clienteId && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                      ⚠️ Debe seleccionar un cliente antes de confirmar el registro.
                    </p>
                  )}
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
        </div>

        <div className="flex justify-end pt-4 mt-4">
          <Button
            type="button"
            onClick={() => setStep(2)}
            className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Siguiente: Cubicaje →
          </Button>
        </div>
      </div>

      {/* ── PASO 2: CUBICAJE BASE ── */}
      <div style={{ display: step === 2 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 2: Cubicaje</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Ingresa las piezas, cantidades y dimensiones para realizar el cubicaje rápido.
          </p>
          <div className={`mt-2 rounded-xl p-1 transition-all duration-300 ${hasStep2Warning ? "border border-red-500/30 bg-red-500/5 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]" : ""}`}>
            <CubicajeInput
              precioEditable={false}
              onChange={(data) => setPiezasJson(JSON.stringify(data.piezas))}
            />
          </div>
          {hasStep2Warning && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
              ⚠️ Debe agregar al menos una pieza antes de confirmar el registro.
            </p>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field
              label="Costo por pie cúbico (S/)"
              type="number"
              min="0"
              step="0.01"
              value={costoPorPieCubico}
              onChange={(e) => setCostoPorPieCubico(Number(e.target.value) || 0)}
            />
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-secondary)]">Pies cúbicos</p>
              <p className="text-xl font-bold">{piesCubicos.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/40 p-3 flex flex-col justify-between">
              <label className="text-xs text-[var(--color-text-secondary)] font-semibold block mb-0.5">
                Costo cubicaje (S/)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-[var(--color-text-secondary)]">S/.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoCubicajeManual}
                  placeholder={costoCubicajeSugerido.toFixed(2)}
                  onChange={(e) => setCostoCubicajeManual(e.target.value)}
                  className="w-full rounded border-0 bg-transparent p-0 text-xl font-bold text-[var(--color-text-primary)] focus:ring-0 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(1)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            onClick={() => setStep(3)}
            className="px-6 py-2"
          >
            Siguiente: Servicios →
          </Button>
        </div>
      </div>

      {/* ── PASO 3: SERVICIOS ESPECIALES ── */}
      <div style={{ display: step === 3 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 3: Servicios especiales (Opcional)</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Activa y edita las tarifas y cantidades de los servicios adicionales solicitados por el cliente.
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
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={estado.activo}
                      onChange={(e) =>
                        setSeleccionados((prev) => ({
                          ...prev,
                          [servicio.id]: { ...estado, activo: e.target.checked },
                        }))
                      }
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
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

          {/* Mano de Obra y Extras */}
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)] space-y-4 mt-4">
            <p className="text-xs uppercase tracking-wide font-bold text-[var(--color-text-secondary)]">Mano de Obra & Extras</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-secondary)]">Mano de obra (S/)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manoDeObra || ""}
                  onChange={(e) => setManoDeObra(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                />
                <span className="text-[10px] text-[var(--color-text-secondary)] block mt-0.5">
                  Mano de obra cargada al cliente.
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)] space-y-3 mt-4">
            <p className="text-xs uppercase tracking-wide font-bold text-[var(--color-text-secondary)]">Madera del cliente (Extras)</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Agrega materiales o piezas traídas por el cliente para control propio.
            </p>
            <div className="space-y-2">
              {extrasMadera.map((item) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={item.descripcion}
                    placeholder="Ej. Madera Cedro 2x4x10"
                    onChange={(e) => {
                      const val = e.target.value;
                      setExtrasMadera((prev) => prev.map((x) => (x.id === item.id ? { ...x, descripcion: val } : x)));
                    }}
                    className="flex-1 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm outline-none"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 1;
                      setExtrasMadera((prev) => prev.map((x) => (x.id === item.id ? { ...x, cantidad: val } : x)));
                    }}
                    className="w-20 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-right outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setExtrasMadera((prev) => prev.filter((x) => x.id !== item.id))}
                    className="text-xs text-red-500 font-semibold px-2 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setExtrasMadera((prev) => [...prev, { id: Date.now() + Math.random(), descripcion: "", cantidad: 1 }])}
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline mt-1 block"
              >
                + Agregar pieza del cliente
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 mt-4 flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(2)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaltarServicios}
              className="px-4 py-2"
            >
              Saltar este paso
            </Button>
            <Button
              type="button"
              onClick={() => setStep(4)}
              className="px-6 py-2"
            >
              Siguiente: Resumen y cobro →
            </Button>
          </div>
        </div>
      </div>

      {/* ── PASO 4: RESUMEN Y COBRO ── */}
      <div style={{ display: step === 4 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 4: Resumen y cobro</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Visualiza los costos acumulados y define el precio final a cobrar al cliente.
          </p>

          <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Desglose de Costos</h4>
            
            <div className="divide-y divide-[var(--color-border)]">
              <div className="flex justify-between py-2.5">
                <div>
                  <p className="font-semibold text-sm">Cubicaje Base ({piesCubicos.toFixed(2)} pies³)</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{totalPT} piezas a S/ {costoPorPieCubico.toFixed(2)} por pie³</p>
                </div>
                <p className="font-bold text-sm">{formatPen(costoCubicaje)}</p>
              </div>

              <div className="flex justify-between py-2.5">
                <div>
                  <p className="font-semibold text-sm">Servicios Especiales</p>
                  {Object.entries(seleccionados).filter(([, v]) => v.activo).length === 0 ? (
                    <p className="text-xs text-[var(--color-text-secondary)]">Ninguno seleccionado</p>
                  ) : (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {Object.entries(seleccionados)
                        .filter(([, v]) => v.activo)
                        .map(([id]) => serviciosEspeciales.find(s => s.id === id)?.nombre)
                        .join(', ')}
                    </p>
                  )}
                </div>
                <p className="font-bold text-sm">{formatPen(totalServiciosEspeciales)}</p>
              </div>

              <div className="flex justify-between py-2.5">
                <div>
                  <p className="font-semibold text-sm">Mano de Obra</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Adicional del servicio</p>
                </div>
                <p className="font-bold text-sm">{formatPen(manoDeObra)}</p>
              </div>

              <div className="flex justify-between py-3 text-[var(--color-primary)]">
                <span className="font-bold text-base">Costo Total Sugerido</span>
                <span className="font-black text-base">{formatPen(precioCalculado)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="precio-cobrado-input" className="text-sm font-semibold text-[var(--color-text-primary)]">
              Precio Cobrado Final (S/) *
            </label>
            <input
              id="precio-cobrado-input"
              type="number"
              min="0"
              step="0.01"
              value={precioCobradoManual}
              placeholder={precioCalculado.toFixed(2)}
              onChange={(e) => setPrecioCobradoManual(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-lg font-bold text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
            />
            <p className="text-xs text-[var(--color-text-secondary)]">
              Deja en blanco para usar el costo total sugerido ({formatPen(precioCalculado)}). El precio es completamente editable.
            </p>
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notas internas (Solo para control propio)
            </label>
            <textarea
              value={notasInternas}
              onChange={(e) => setNotasInternas(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="Estas notas son de carácter interno y NO se imprimirán en el comprobante del cliente..."
            />
          </div>

          {/* ── Condición de pago ── */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 mt-4">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Condición de pago</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="yape">Yape</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="billetera_digital">Billetera digital</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Modalidad</label>
                <select
                  value={modalidadPago}
                  onChange={(e) => setModalidadPago(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                >
                  <option value="contado">Contado</option>
                  <option value="adelanto">Adelanto + saldo</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
            </div>
            {modalidadPago === "adelanto" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Adelanto cobrado (S/) — opcional</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adelanto}
                  onChange={(e) => setAdelanto(e.target.value)}
                  placeholder="0.00"
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                />
                <p className="text-xs text-[var(--color-text-secondary)]">Si pones un monto &gt; 0, se asienta como ingreso parcial en caja.</p>
              </div>
            )}
            {modalidadPago === "credito" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Fecha límite de pago</label>
                <input
                  type="date"
                  value={fechaPagoCredito}
                  onChange={(e) => setFechaPagoCredito(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 mt-4 pt-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Utilidad estimada</p>
              <p className="text-2xl font-black text-[var(--color-success)]">{formatPen(utilidad)}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 flex flex-col justify-center">
              <MargenIndicator costo={costoTotalAserradero} precio={precioCobrado} label="Margen del servicio" />
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(3)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            onClick={() => setStep(5)}
            className="px-6 py-2"
          >
            Siguiente: Confirmar →
          </Button>
        </div>
      </div>

      {/* ── PASO 5: CONFIRMAR Y REGISTRAR ── */}
      <div style={{ display: step === 5 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 5: Confirmar y registrar</h3>
          
          {hasStep1Warning || hasStep2Warning ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-600 dark:text-red-400 space-y-1">
              <p className="text-sm font-bold">⚠️ Faltan datos obligatorios para registrar el servicio</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 font-medium">
                 {hasStep1Warning && (
                   <li>
                     {!clienteId 
                       ? "Debes seleccionar un cliente en el Paso 1."
                       : "El cliente seleccionado no tiene RUC de 11 dígitos para emitir Factura."}
                   </li>
                 )}
                 {hasStep2Warning && <li>Debes agregar al menos una pieza en el Paso 2.</li>}
              </ul>
              <p className="text-[11px] text-red-500/80 pt-1">
                Por favor, regresa a los pasos correspondientes usando los botones de navegación para completar la información antes de guardar.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4 text-[var(--color-success)]">
              <p className="text-sm font-semibold">✓ Todo listo para registrar</p>
              <p className="text-xs">Por favor, revisa el resumen a continuación antes de proceder a guardar el servicio.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
             {/* Resumen Cliente y Cubicaje */}
             <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
               <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Cliente & Comprobante</h4>
               <p className="text-sm">
                 <strong>Cliente:</strong> {todosLosClientes.find((c) => c.id === clienteId)?.nombre ?? "No seleccionado"}
               </p>
               <p className="text-sm">
                 <strong>Comprobante:</strong> <span className="capitalize">{tipoComprobante}</span>
               </p>
               {tipoComprobante === "factura" && (
                 <p className="text-xs text-[var(--color-text-secondary)]">
                   · RUC: {selectedClienteRuc || <span className="text-red-500 font-semibold">Falta RUC</span>}
                 </p>
               )}
               {tipoComprobante === "boleta" && (
                 <p className="text-xs text-[var(--color-text-secondary)]">
                   · DNI/Doc: {selectedClienteDoc || "Opcional"}
                 </p>
               )}
               <p className="text-sm">
                 <strong>Fecha de Registro:</strong> {hoy}
               </p>
              
              <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider mt-4">Detalle de Cubicaje</h4>
              <p className="text-sm">
                <strong>Pies Cúbicos Totales:</strong> {piesCubicos.toFixed(2)} ft³
              </p>
              <p className="text-sm">
                <strong>Costo de Cubicaje (Base):</strong> {formatPen(costoCubicaje)}
              </p>
              
              <div className="text-xs border-t border-[var(--color-border)] pt-2 mt-2 max-h-32 overflow-y-auto space-y-1">
                <span className="font-semibold text-[var(--color-text-secondary)]">Piezas ingresadas:</span>
                {piezas.map((p, i) => (
                  <div key={i} className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>{p.cantidad ?? 0} pzs ({p.espesor ?? 0}{"\""} x {p.ancho ?? 0}{"\""} x {p.largo ?? 0}{"'"})</span>
                    <span>{p.subtotalPT ?? 0} PT</span>
                  </div>
                ))}
              </div>
             </div>

             {/* Resumen Servicios y Cobro */}
             <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
               <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Servicios Especiales & Extras</h4>
               <div className="space-y-1.5 max-h-32 overflow-y-auto">
                 {lineasPayload
                   .filter((s) => s.tipo !== "nota_interna" && s.tipo !== "extra_madera_cliente")
                   .map((s) => (
                     <div key={s.id} className="flex justify-between text-sm">
                       <span>{s.nombre} <span className="text-xs text-[var(--color-text-secondary)]">(x{s.cantidad})</span></span>
                       <span className="font-semibold">{formatPen(s.subtotal)}</span>
                     </div>
                   ))}
                 {extrasMadera.length > 0 && (
                   <div className="border-t border-dashed border-[var(--color-border)] pt-1.5 mt-1.5">
                     <span className="text-xs font-bold text-[var(--color-text-secondary)]">Madera del Cliente:</span>
                     {extrasMadera.map((em) => (
                       <div key={em.id} className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                         • {em.descripcion} ({em.cantidad} pzs)
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
                 <div className="flex justify-between text-sm">
                   <span className="text-[var(--color-text-secondary)]">Subtotal Cubicaje:</span>
                   <span>{formatPen(costoCubicaje)}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-[var(--color-text-secondary)]">Mano de Obra:</span>
                   <span>{formatPen(manoDeObra)}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-[var(--color-text-secondary)]">Subtotal Servicios:</span>
                   <span>{formatPen(totalServiciosEspeciales)}</span>
                 </div>
                  <div className="flex justify-between items-center text-base font-black border-t border-[var(--color-border)] pt-2 text-[var(--color-primary)]">
                    <span>PRECIO FINAL COBRADO:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-[var(--color-text-secondary)]">S/.</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={precioCobradoManual}
                        placeholder={precioCalculado.toFixed(2)}
                        onChange={(e) => setPrecioCobradoManual(e.target.value)}
                        className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm font-black text-right text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
                      />
                    </div>
                  </div>
                 <div className="flex justify-between text-xs text-[var(--color-success)] font-bold">
                   <span>Utilidad Estimada:</span>
                   <span>{formatPen(utilidad)}</span>
                 </div>
                 <div className="pt-1">
                   <MargenIndicator costo={costoTotalAserradero} precio={precioCobrado} label="Margen Final" />
                 </div>
               </div>
             </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(4)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            size="lg"
            disabled={hasStep1Warning || hasStep2Warning}
            className="px-8 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Registrar servicio ✓
          </Button>
        </div>
      </div>

      {/* Inputs ocultos requeridos para el Server Action */}
      <input type="hidden" name="pies_cubicos" value={piesCubicos.toFixed(4)} />
      <input type="hidden" name="costo_cubicaje" value={costoCubicaje.toFixed(2)} />
      <input type="hidden" name="precio_cobrado" value={precioCobrado.toFixed(2)} />
      <input type="hidden" name="lineas_json" value={JSON.stringify(lineasPayload)} />
      <input type="hidden" name="metodo_pago" value={metodoPago} />
      <input type="hidden" name="modalidad_pago" value={modalidadPago} />
      <input type="hidden" name="adelanto" value={adelanto || "0"} />
      {fechaPagoCredito && <input type="hidden" name="fecha_pago_credito" value={fechaPagoCredito} />}
    </form>
  );
}
