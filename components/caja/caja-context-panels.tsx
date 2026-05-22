"use client";

import { submitCajaMovimientoForm } from "@/app/actions";
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
  const hoy = new Date().toISOString().slice(0, 10);

  // Controlled States
  const [medio, setMedio] = useState("efectivo");
  const [customMedio, setCustomMedio] = useState("");
  const [descripcion, setDescripcion] = useState("");

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
      <Field name="fecha" type="date" label="Fecha" defaultValue={hoy} required />
      
      <SelectField name="tipo" label="Tipo" required defaultValue="ingreso">
        <option value="ingreso">Ingreso</option>
        <option value="egreso">Egreso</option>
      </SelectField>

      <SelectField
        name="medio"
        label="Medio"
        required
        value={medio}
        onChange={(e) => setMedio(e.target.value)}
      >
        <option value="efectivo">Efectivo</option>
        <option value="yape">Yape</option>
        <option value="banco">Banco</option>
        <option value="otro">Otro</option>
      </SelectField>

      {medio === "otro" && (
        <Field
          label="Especifique medio de pago"
          placeholder="Ej: Plin, Tarjeta, etc."
          value={customMedio}
          onChange={(e) => setCustomMedio(e.target.value)}
          required
        />
      )}

      <Field name="categoria" label="Categoría" placeholder="Ingresos por venta" required />
      <Field name="monto" label="Monto (S/)" type="number" min="0" step="0.01" required />
      
      <Field
        label="Descripción"
        placeholder="Detalle opcional"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <input
        type="hidden"
        name="descripcion"
        value={medio === "otro" && customMedio.trim() ? `[Medio: ${customMedio.trim()}] ${descripcion}` : descripcion}
      />

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

export function CajaContextPanels() {
  const [movOpen, setMovOpen] = useState(false);
  const [movFormKey, setMovFormKey] = useState(0);

  const closeMov = useCallback(() => {
    setMovOpen(false);
    setMovFormKey((k) => k + 1);
  }, []);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar movimiento"
        title="Nuevo movimiento de caja"
        description="Ingreso o egreso en un panel puntual."
        open={movOpen}
        onOpenChange={(next) => {
          setMovOpen(next);
          if (!next) setMovFormKey((k) => k + 1);
        }}
      >
        <CajaMovimientoForm key={movFormKey} onCloseAndReset={closeMov} />
      </ContextActionPanel>
    </>
  );
}
