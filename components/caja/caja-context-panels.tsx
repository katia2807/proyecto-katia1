"use client";

import {
  submitCajaMovimientoForm,
  submitRepetirGastosMesAnteriorForm,
} from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { FotoUpload } from "@/components/sales/foto-upload";
import { useToast } from "@/components/ui/toast";
import { Field, SelectField } from "@/components/ui/field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { mutationFormInitialState, type MutationFormState } from "@/lib/mutation-form-state";
import { useActionState, useCallback, useEffect, useState } from "react";

function CajaMovimientoForm({
  onCloseAndReset,
}: {
  onCloseAndReset: () => void;
}) {
  const { showToast } = useToast();
  const [state, formAction] = useActionState(
    async (_p: MutationFormState, formData: FormData) => submitCajaMovimientoForm(_p, formData),
    mutationFormInitialState,
  );

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onCloseAndReset();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onCloseAndReset]);

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <Field name="fecha" type="date" label="Fecha" required />
      <SelectField name="tipo" label="Tipo" required defaultValue="ingreso">
        <option value="ingreso">Ingreso</option>
        <option value="egreso">Egreso</option>
        <option value="transferencia">Transferencia</option>
      </SelectField>
      <SelectField name="medio" label="Medio" required defaultValue="efectivo">
        <option value="efectivo">Efectivo</option>
        <option value="yape">Yape</option>
        <option value="banco">Banco</option>
        <option value="otro">Otro</option>
      </SelectField>
      <Field name="categoria" label="Categoría" placeholder="Ingresos por venta" required />
      <Field name="monto" label="Monto (S/)" type="number" min="0" step="0.01" required />
      <Field name="descripcion" label="Descripción" placeholder="Detalle opcional" />
      <div className="md:col-span-2">
        <FotoUpload
          bucket="caja"
          name="url_comprobante"
          label="Adjuntar comprobante (PNG/JPG/PDF, opcional)"
        />
      </div>
      <label className="md:col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="es_personal" value="on" />
        <span>
          Marcar como <strong>gasto personal de la jefa</strong> (no impacta utilidad)
        </span>
      </label>
      <div className="md:col-span-2">
        <PendingSubmitButton idleText="Registrar movimiento" />
      </div>
    </form>
  );
}

function RepetirMesForm({ onCloseAndReset }: { onCloseAndReset: () => void }) {
  const { showToast } = useToast();
  const [state, formAction] = useActionState(
    async (_p: MutationFormState, formData: FormData) =>
      submitRepetirGastosMesAnteriorForm(_p, formData),
    mutationFormInitialState,
  );

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onCloseAndReset();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onCloseAndReset]);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Útil para gastos fijos: luz, alquiler, planilla, internet, etc. Cada copia se marca con el
        sufijo <em>(recurrente)</em>.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="incluir_personal" value="on" />
        <span>Incluir también gastos personales de la jefa</span>
      </label>
      <PendingSubmitButton idleText="Generar copias del mes anterior" />
    </form>
  );
}

export function CajaContextPanels() {
  const [movOpen, setMovOpen] = useState(false);
  const [movFormKey, setMovFormKey] = useState(0);
  const [repOpen, setRepOpen] = useState(false);
  const [repFormKey, setRepFormKey] = useState(0);

  const closeMov = useCallback(() => {
    setMovOpen(false);
    setMovFormKey((k) => k + 1);
  }, []);

  const closeRep = useCallback(() => {
    setRepOpen(false);
    setRepFormKey((k) => k + 1);
  }, []);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar movimiento"
        title="Nuevo movimiento de caja"
        description="Ingreso, egreso o transferencia en un panel puntual."
        open={movOpen}
        onOpenChange={(next) => {
          setMovOpen(next);
          if (!next) setMovFormKey((k) => k + 1);
        }}
      >
        <CajaMovimientoForm key={movFormKey} onCloseAndReset={closeMov} />
      </ContextActionPanel>

      <ContextActionPanel
        presentation="dialog"
        triggerLabel="Repetir mes anterior"
        title="Replicar gastos recurrentes"
        description="Copia los egresos del mes pasado al mes actual con la misma fecha y monto."
        open={repOpen}
        onOpenChange={(next) => {
          setRepOpen(next);
          if (!next) setRepFormKey((k) => k + 1);
        }}
      >
        <RepetirMesForm key={repFormKey} onCloseAndReset={closeRep} />
      </ContextActionPanel>
    </>
  );
}
