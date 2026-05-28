"use client";

import { cerrarContratoAlquiler } from "@/app/actions";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatPen } from "@/lib/utils";

type ContratoLite = {
  id: string;
  codigo: string | null;
  monto_total: number | null;
  penalidad_retraso_pago_pct: number;
  penalidad_devolucion_tardia_pct: number;
  penalidad_danios_pct: number;
};

type CierreContratoFormProps = {
  contratos: ContratoLite[];
};

export function CierreContratoForm({ contratos }: CierreContratoFormProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(1);

  // Paso 1 State
  const [contratoId, setContratoId] = useState(contratos[0]?.id ?? "");
  const [fechaCierre, setFechaCierre] = useState(hoy);

  // Paso 2 State (Opcional)
  const [observaciones, setObservaciones] = useState("");

  // Paso 3 State (Opcional)
  const [retraso, setRetraso] = useState(false);
  const [devolucion, setDevolucion] = useState(false);
  const [danios, setDanios] = useState(false);

  const contrato = contratos.find((c) => c.id === contratoId);

  const penalidadCalc = useMemo(() => {
    if (!contrato || !contrato.monto_total) return 0;
    let pen = 0;
    if (retraso) pen += (contrato.monto_total * contrato.penalidad_retraso_pago_pct) / 100;
    if (devolucion) pen += (contrato.monto_total * contrato.penalidad_devolucion_tardia_pct) / 100;
    if (danios) pen += (contrato.monto_total * contrato.penalidad_danios_pct) / 100;
    return Number(pen.toFixed(2));
  }, [contrato, retraso, devolucion, danios]);

  // Validaciones
  const hasStep1Warning = !contratoId;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await cerrarContratoAlquiler(formData);
        if (res && !res.ok) {
          setErrorMessage(res.error || "Ocurrió un error al cerrar el contrato.");
        } else {
          setSuccessMessage("¡Contrato cerrado exitosamente!");
          router.refresh();
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Error al procesar la solicitud.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* ── STEPPER DE WIZARD ── */}
      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { n: 1, label: "Contrato" },
            { n: 2, label: "Retorno" },
            { n: 3, label: "Penalidades" },
            { n: 4, label: "Confirmar" },
          ].map((item, index) => {
            const isCompleted = step > item.n;
            const isActive = step === item.n;
            const hasWarning = item.n === 1 && hasStep1Warning;
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

      {/* ── PASO 1: SELECCIÓN DEL CONTRATO ── */}
      <div style={{ display: step === 1 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 1: Selección del contrato</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Elige el contrato abierto que deseas cerrar y especifica la fecha del cierre de operaciones.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Contrato a cerrar
              <select
                name="contrato_id"
                value={contratoId}
                onChange={(e) => setContratoId(e.target.value)}
                required
                className={`h-10 rounded-xl border bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                  hasStep1Warning
                    ? "border-red-500/80 focus-visible:border-red-500 focus-visible:ring-red-500/40"
                    : "border-[var(--color-border)]"
                }`}
              >
                {contratos.length === 0 ? (
                  <option value="">No hay contratos abiertos</option>
                ) : (
                  contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo ?? c.id.slice(0, 8)} · {formatPen(c.monto_total ?? 0)}
                    </option>
                  ))
                )}
              </select>
              {hasStep1Warning && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                  ⚠️ Se requiere tener al menos un contrato seleccionado.
                </p>
              )}
            </label>

            <Field
              name="fecha_cierre"
              type="date"
              label="Fecha de cierre"
              value={fechaCierre}
              onChange={(e) => setFechaCierre(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 mt-4">
          <Button
            type="button"
            onClick={() => setStep(2)}
            className="px-6 py-2 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            Siguiente: Estado del Retorno →
          </Button>
        </div>
      </div>

      {/* ── PASO 2: ESTADO DEL RETORNO ── */}
      <div style={{ display: step === 2 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 2: Estado del retorno (Opcional)</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Describe el estado en el que se devuelve el equipo en alquiler, daños observados o detalles de entrega. Puede dejarse en blanco.
          </p>
          <div>
            <Field
              name="observaciones"
              label="Observaciones del retorno"
              placeholder="Ej. El equipo regresó en buen estado general, con ligeros arañazos en la tolva…"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
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
            Siguiente: Penalidades →
          </Button>
        </div>
      </div>

      {/* ── PASO 3: PENALIDADES ── */}
      <div style={{ display: step === 3 ? "block" : "none" }} className="space-y-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Paso 3: Penalidades (Opcional)</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Aplica penalidades basadas en porcentajes del monto de alquiler del contrato seleccionado.
          </p>

          <fieldset className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)] space-y-3">
            <legend className="px-2 text-xs uppercase tracking-wide font-bold text-[var(--color-text-secondary)]">
              Penalidades aplicables
            </legend>
            
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none py-1">
              <input
                type="checkbox"
                name="retraso_pago"
                checked={retraso}
                onChange={(e) => setRetraso(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)]">Retraso en el pago</span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-1">({contrato?.penalidad_retraso_pago_pct ?? 3}%)</span>
                {contrato && contrato.monto_total && retraso && (
                  <span className="text-xs text-[var(--color-danger)] font-bold ml-2">
                    (+{formatPen((contrato.monto_total * contrato.penalidad_retraso_pago_pct) / 100)})
                  </span>
                )}
              </div>
            </label>
            
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none py-1">
              <input
                type="checkbox"
                name="devolucion_tardia"
                checked={devolucion}
                onChange={(e) => setDevolucion(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)]">Devolución tardía del equipo</span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-1">({contrato?.penalidad_devolucion_tardia_pct ?? 3}%)</span>
                {contrato && contrato.monto_total && devolucion && (
                  <span className="text-xs text-[var(--color-danger)] font-bold ml-2">
                    (+{formatPen((contrato.monto_total * contrato.penalidad_devolucion_tardia_pct) / 100)})
                  </span>
                )}
              </div>
            </label>
            
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none py-1">
              <input
                type="checkbox"
                name="danios"
                checked={danios}
                onChange={(e) => setDanios(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)]">Daños al equipo</span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-1">({contrato?.penalidad_danios_pct ?? 3}%)</span>
                {contrato && contrato.monto_total && danios && (
                  <span className="text-xs text-[var(--color-danger)] font-bold ml-2">
                    (+{formatPen((contrato.monto_total * contrato.penalidad_danios_pct) / 100)})
                  </span>
                )}
              </div>
            </label>
          </fieldset>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-4">
            <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Penalidad total a cobrar</p>
            <p className="text-3xl font-black text-[var(--color-primary)] mt-1">{formatPen(penalidadCalc)}</p>
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

          {hasStep1Warning ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-600 dark:text-red-400 space-y-1">
              <p className="text-sm font-bold flex items-center gap-1.5">⚠️ No se puede proceder con el cierre</p>
              <p className="text-xs font-medium">Debe haber un contrato abierto seleccionado en el Paso 1 para poder efectuar su cierre.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4 text-[var(--color-success)]">
              <p className="text-sm font-semibold flex items-center gap-1.5">✓ Listo para procesar cierre</p>
              <p className="text-xs">Por favor, revisa el balance a continuación antes de aplicar las penalidades y dar de baja el alquiler.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Detalles del Contrato */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)]">
              <div>
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Contrato Seleccionado</h4>
                <p className="text-base font-bold mt-1 text-[var(--color-text-primary)]">
                  {contrato?.codigo ?? (contratoId ? `Ref: ${contratoId.slice(0, 8)}` : "No seleccionado")}
                </p>
                {contrato && (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Monto Original: <strong>{formatPen(contrato.monto_total ?? 0)}</strong>
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--color-border)] pt-3">
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Detalles de la Devolución</h4>
                <p className="text-sm mt-1">
                  <strong>Fecha de cierre:</strong> {fechaCierre || <span className="text-red-500 font-medium">No ingresada</span>}
                </p>
                <div className="text-xs text-[var(--color-text-secondary)] mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-2.5 max-h-32 overflow-y-auto">
                  <span className="font-bold text-[var(--color-text-primary)] block mb-0.5">Observaciones de retorno:</span>
                  {observaciones.trim() ? observaciones : <span className="italic">Sin observaciones registradas</span>}
                </div>
              </div>
            </div>

            {/* Penalidades y Saldo Final */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-bg)] flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase text-[var(--color-text-secondary)] tracking-wider">Desglose de Penalidades</h4>
                <div className="mt-2 space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[var(--color-text-secondary)]">Retraso en pago:</span>
                    <span className={retraso ? "text-[var(--color-danger)] font-bold" : "text-[var(--color-text-secondary)]"}>
                      {retraso && contrato && contrato.monto_total
                        ? `+${formatPen((contrato.monto_total * contrato.penalidad_retraso_pago_pct) / 100)}`
                        : "No aplica"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[var(--color-text-secondary)]">Devolución tardía:</span>
                    <span className={devolucion ? "text-[var(--color-danger)] font-bold" : "text-[var(--color-text-secondary)]"}>
                      {devolucion && contrato && contrato.monto_total
                        ? `+${formatPen((contrato.monto_total * contrato.penalidad_devolucion_tardia_pct) / 100)}`
                        : "No aplica"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[var(--color-text-secondary)]">Daños al equipo:</span>
                    <span className={danios ? "text-[var(--color-danger)] font-bold" : "text-[var(--color-text-secondary)]"}>
                      {danios && contrato && contrato.monto_total
                        ? `+${formatPen((contrato.monto_total * contrato.penalidad_danios_pct) / 100)}`
                        : "No aplica"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--color-border)] pt-3">
                <div className="flex justify-between text-lg font-black text-[var(--color-primary)]">
                  <span>TOTAL PENALIDADES:</span>
                  <span>{formatPen(penalidadCalc)}</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-normal">
                  * Al confirmar el cierre se registrará el cobro de penalidades y el contrato pasará a estado de facturación/cierre definitivo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] p-4 text-[var(--color-danger)] text-sm font-semibold flex items-center gap-2 animate-bounce">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-xl border border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] p-4 text-[var(--color-success)] text-sm font-semibold flex items-center gap-2">
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        <div className="flex justify-between pt-4 mt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => setStep(3)}
            className="px-6 py-2"
          >
            ← Anterior
          </Button>
          <Button
            disabled={hasStep1Warning || isPending}
            className="px-8 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all"
          >
            {isPending ? "Procesando..." : "Cerrar contrato ✓"}
          </Button>
        </div>
      </div>
    </form>
  );
}
