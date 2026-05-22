"use client";

import type { ComponentProps } from "react";
import { useMemo, useState } from "react";

/** Firma que admite `<form action>` con `useActionState` (React tipa la acción enlazada como 1 arg). */
type FormActionProp = Exclude<ComponentProps<"form">["action"], string | undefined>;
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field, SelectField } from "@/components/ui/field";
import { contratoClientesToCompleto } from "@/lib/combobox-mocks";
import { formatPen } from "@/lib/utils";

type Cliente = { id: string; nombre: string; ruc?: string | null };

type ContratoAlquilerFormProps = {
  clientes: Cliente[];
  mockData?: boolean;
  /** Acción enlazada con `useActionState` (submit + toast + cierre en el panel). */
  panelAction: FormActionProp;
};

const tarifas = [
  { value: "hora_maquina", label: "Por hora máquina" },
  { value: "m3", label: "Por m³ bombeado" },
  { value: "dia", label: "Por día" },
] as const;

/** Etiqueta dinámica según la unidad de tarifa seleccionada */
function labelCantidad(tarifaUnidad: string): string {
  if (tarifaUnidad === "hora_maquina") return "Cantidad de horas";
  if (tarifaUnidad === "m3") return "Cantidad de m³";
  if (tarifaUnidad === "dia") return "Cantidad de días";
  return "Cantidad de unidades";
}

export function ContratoAlquilerForm({
  clientes,
  mockData = false,
  panelAction,
}: ContratoAlquilerFormProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(1);

  // Paso 1 State
  const [clienteId, setClienteId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [clientesLocales, setClientesLocales] = useState<{ id: string; nombre: string; ruc?: string | null }[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");

  // Paso 2 State
  const [activo, setActivo] = useState("");
  const [representante, setRepresentante] = useState("");
  const [rucEmpresa, setRucEmpresa] = useState("");
  const [direccionEjecucion, setDireccionEjecucion] = useState("");

  // Paso 3 State
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaTermino, setFechaTermino] = useState("");
  const [tarifa, setTarifa] = useState(0);
  const [dias, setDias] = useState(1);
  const [tarifaUnidad, setTarifaUnidad] = useState<(typeof tarifas)[number]["value"]>(
    "hora_maquina",
  );

  const montoTotal = useMemo(() => {
    return tarifa * dias;
  }, [tarifa, dias]);

  const deposito30 = useMemo(() => Number((montoTotal * 0.3).toFixed(2)), [montoTotal]);

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);
  const clientesCombo = useMemo(() => contratoClientesToCompleto(todosLosClientes), [todosLosClientes]);

  // Validaciones visuales (sin bloqueos)
  const hasStep1Warning = !clienteId;
  const hasStep2Warning = !activo.trim();
  const hasStep3Warning = !fechaInicio || tarifa <= 0 || dias <= 0;

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  return (
    <form action={panelAction} noValidate className="space-y-6">
      {/* ── STEPPER DE WIZARD ── */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { n: 1, label: "Cliente" },
            { n: 2, label: "Activo" },
            { n: 3, label: "Fechas/Tarifa" },
            { n: 4, label: "Confirmar" },
          ].map((item, index) => {
            const isCompleted = step > item.n;
            const isActive = step === item.n;
            const hasWarning =
              (item.n === 1 && hasStep1Warning) ||
              (item.n === 2 && hasStep2Warning) ||
              (item.n === 3 && hasStep3Warning);
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
                {index < 3 && (
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
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 1: Datos del cliente</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Busca un cliente existente o registra uno nuevo, y opcionalmente define un código para el contrato.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
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
                    inputAriaLabel="Cliente para contrato de alquiler"
                    className={hasStep1Warning ? "[&_input]:!border-red-500/80 [&_input]:focus:!border-red-500 [&_input]:focus:!ring-red-500 [&_input]:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : ""}
                  />
                  {hasStep1Warning && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                      ⚠️ Debe seleccionar un cliente para continuar.
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

            <Field
              name="codigo"
              label="Código de contrato"
              placeholder="CT-2026-0001 (Automático si se deja vacío)"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-4">
          <Button
            type="button"
            onClick={() => setStep(2)}
            className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Siguiente: Datos del Activo →
          </Button>
        </div>
      </div>

      {/* ── PASO 2: DATOS DEL ACTIVO ── */}
      <div style={{ display: step === 2 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 2: Datos del activo</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Ingresa la información del equipo en alquiler, del representante y la dirección donde se ejecutará la obra.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Field
                name="activo"
                label="Activo / equipo"
                placeholder="Bomba Mixer"
                required
                value={activo}
                onChange={(e) => setActivo(e.target.value)}
                className={hasStep2Warning ? "!border-red-500/80 focus-visible:!border-red-500 focus-visible:!ring-red-500/40" : ""}
              />
              {hasStep2Warning && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                  ⚠️ Debe ingresar el activo o equipo.
                </p>
              )}
            </div>

            <Field
              name="representante"
              label="Representante de la empresa"
              placeholder="Ing. responsable"
              value={representante}
              onChange={(e) => setRepresentante(e.target.value)}
            />

            <Field
              name="ruc_empresa"
              label="RUC de la empresa"
              placeholder="20XXXXXXXXX"
              inputMode="numeric"
              maxLength={11}
              value={rucEmpresa}
              onChange={(e) => setRucEmpresa(e.target.value)}
            />

            <Field
              className="md:col-span-2"
              name="direccion_ejecucion"
              label="Dirección de ejecución de obra"
              placeholder="Av. / Mz. y Lt."
              value={direccionEjecucion}
              onChange={(e) => setDireccionEjecucion(e.target.value)}
            />
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
            className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Siguiente: Fechas y tarifa →
          </Button>
        </div>
      </div>

      {/* ── PASO 3: FECHAS Y TARIFA ── */}
      <div style={{ display: step === 3 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 3: Fechas y tarifa</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Define la duración del alquiler, la tarifa y la cantidad correspondiente. El monto total y el depósito del 30% se calcularán automáticamente.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Field
                name="fecha_inicio"
                label="Fecha de inicio"
                type="date"
                required
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={!fechaInicio ? "!border-red-500/80 focus-visible:!border-red-500 focus-visible:!ring-red-500/40" : ""}
              />
              {!fechaInicio && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                  ⚠️ Debe seleccionar la fecha de inicio.
                </p>
              )}
            </div>

            <Field
              name="fecha_termino"
              label="Fecha de término estimada"
              type="date"
              value={fechaTermino}
              onChange={(e) => setFechaTermino(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-4 space-y-4">
            <p className="text-xs uppercase tracking-wide font-bold text-[var(--color-text-secondary)]">
              Configuración de Tarifa y Monto
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                name="tarifa_unidad"
                label="Unidad de tarifa"
                value={tarifaUnidad}
                onChange={(e) => setTarifaUnidad(e.target.value as (typeof tarifas)[number]["value"])}
              >
                {tarifas.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SelectField>

              <div className="space-y-1">
                <Field
                  name="tarifa"
                  label={`Tarifa (S/ por ${tarifaUnidad === "hora_maquina" ? "hora" : tarifaUnidad === "m3" ? "m³" : "día"})`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={tarifa || ""}
                  onChange={(e) => setTarifa(Number(e.target.value) || 0)}
                  required
                  className={tarifa <= 0 ? "!border-red-500/80 focus-visible:!border-red-500 focus-visible:!ring-red-500/40" : ""}
                />
                {tarifa <= 0 && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                    ⚠️ La tarifa debe ser mayor a 0.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Field
                  name="dias_alquiler"
                  label={labelCantidad(tarifaUnidad)}
                  type="number"
                  min="1"
                  step="1"
                  value={dias || ""}
                  onChange={(e) => setDias(Number(e.target.value) || 0)}
                  className={dias <= 0 ? "!border-red-500/80 focus-visible:!border-red-500 focus-visible:!ring-red-500/40" : ""}
                />
                {dias <= 0 && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                    ⚠️ La cantidad debe ser al menos 1.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <p className="text-xs text-[var(--color-text-secondary)]">Monto total</p>
                <p className="text-2xl font-bold">{formatPen(montoTotal)}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/40 p-3">
                <p className="text-xs text-[var(--color-text-secondary)]">Depósito 30%</p>
                <p className="text-2xl font-black">{formatPen(deposito30)}</p>
              </div>
            </div>
            <input type="hidden" name="monto_total" value={montoTotal.toFixed(2)} />
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface)] space-y-3">
            <p className="text-xs uppercase tracking-wide font-bold text-[var(--color-text-secondary)]">
              Datos de pago
            </p>
            <PagoFormFields defaultModalidadPago="adelanto" />
          </div>
        </div>

        <div className="flex justify-between pt-4 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(2)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            onClick={() => setStep(4)}
            className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Siguiente: Resumen y confirmar →
          </Button>
        </div>
      </div>

      {/* ── PASO 4: RESUMEN Y CONFIRMAR ── */}
      <div style={{ display: step === 4 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 4: Resumen y confirmar</h3>

          {hasStep1Warning || hasStep2Warning || hasStep3Warning ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-600 dark:text-red-400 space-y-2">
              <p className="text-sm font-bold flex items-center gap-1.5">
                ⚠️ Faltan datos obligatorios para registrar el contrato
              </p>
              <ul className="list-disc list-inside text-xs space-y-1 font-medium">
                {hasStep1Warning && <li>Debes seleccionar un cliente en el Paso 1.</li>}
                {hasStep2Warning && <li>Debes ingresar un activo/equipo en el Paso 2.</li>}
                {hasStep3Warning && (
                  <>
                    {!fechaInicio && <li>Debes ingresar la fecha de inicio en el Paso 3.</li>}
                    {tarifa <= 0 && <li>Debes ingresar una tarifa mayor a 0 en el Paso 3.</li>}
                    {dias <= 0 && <li>Debes ingresar una cantidad mayor a 0 en el Paso 3.</li>}
                  </>
                )}
              </ul>
              <p className="text-[11px] text-red-500/80 pt-1 border-t border-red-500/10 mt-1">
                Por favor, regresa a los pasos correspondientes usando los botones de navegación o haciendo clic en el stepper superior para completar la información antes de registrar.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4 text-[var(--color-success)]">
              <p className="text-sm font-semibold flex items-center gap-1.5">✓ Todo listo para registrar</p>
              <p className="text-xs">Por favor, revisa el resumen a continuación antes de proceder a crear el contrato de alquiler.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Cliente y Activo */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
              <div>
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Cliente & Contrato</h4>
                <p className="text-sm mt-1">
                  <strong>Cliente:</strong> {todosLosClientes.find((c) => c.id === clienteId)?.nombre ?? <span className="text-red-500 font-medium">No seleccionado</span>}
                </p>
                <p className="text-sm mt-0.5">
                  <strong>Código de contrato:</strong> {codigo.trim() || <span className="text-amber-500 font-medium font-mono text-xs">CT-XXXX-XXXX (Automático)</span>}
                </p>
              </div>

              <div className="border-t border-[var(--color-border)] pt-3">
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Detalles del Activo</h4>
                <p className="text-sm mt-1">
                  <strong>Activo / Equipo:</strong> {activo.trim() || <span className="text-red-500 font-medium">No ingresado</span>}
                </p>
                {representante.trim() && (
                  <p className="text-sm mt-0.5">
                    <strong>Representante:</strong> {representante}
                  </p>
                )}
                {rucEmpresa.trim() && (
                  <p className="text-sm mt-0.5">
                    <strong>RUC Empresa:</strong> {rucEmpresa}
                  </p>
                )}
                {direccionEjecucion.trim() && (
                  <p className="text-sm mt-0.5">
                    <strong>Dirección Obra:</strong> {direccionEjecucion}
                  </p>
                )}
              </div>
            </div>

            {/* Fechas, Tarifas y Totales */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
              <div>
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Fechas de Alquiler</h4>
                <p className="text-sm mt-1">
                  <strong>Fecha de inicio:</strong> {fechaInicio || <span className="text-red-500 font-medium">No ingresada</span>}
                </p>
                <p className="text-sm mt-0.5">
                  <strong>Fecha de término:</strong> {fechaTermino || <span className="text-[var(--color-text-secondary)]">No estimada</span>}
                </p>
              </div>

              <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Cálculo de Tarifas</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Tarifa ({tarifas.find(t => t.value === tarifaUnidad)?.label}):</span>
                  <span className="font-semibold">{formatPen(tarifa)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{labelCantidad(tarifaUnidad)}:</span>
                  <span className="font-semibold">{dias}</span>
                </div>
                <div className="flex justify-between text-base font-black border-t border-[var(--color-border)] pt-2 text-[var(--color-primary)]">
                  <span>MONTO TOTAL:</span>
                  <span>{formatPen(montoTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[var(--color-success)] bg-[var(--color-success)]/10 px-2 py-1.5 rounded-lg border border-[var(--color-success)]/20 mt-1">
                  <span>Depósito de garantía (30%):</span>
                  <span>{formatPen(deposito30)}</span>
                </div>
              </div>
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
            size="lg"
            disabled={hasStep1Warning || hasStep2Warning || hasStep3Warning}
            className="px-8 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Crear contrato ✓
          </Button>
        </div>
      </div>
    </form>
  );
}
