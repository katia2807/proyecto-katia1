"use client";

import { submitCajaMovimientoForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { FotoUpload } from "@/components/sales/foto-upload";
import { useToast } from "@/components/ui/toast";
import { Field, SelectField } from "@/components/ui/field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { mutationFormInitialState, type MutationFormState } from "@/lib/mutation-form-state";
import { CAJA_MONTO_MAXIMO, cajaFechaHoy, parseCajaMonto } from "@/lib/caja-movimiento";
import { cajaMedioLabel } from "@/lib/caja-presentacion";
import { crearEnvioCaja } from "@/lib/caja-envio";
import type { EstadoArchivoUpload } from "@/lib/archivo-upload";
import type { CajaVista } from "@/lib/caja-resumen-data";
import { formatDate, formatPen } from "@/lib/utils";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";

function CajaMovimientoForm({
  onCloseAndReset,
  vista,
  onPendingChange,
}: {
  onCloseAndReset: () => void;
  vista: CajaVista;
  onPendingChange: (pending: boolean) => void;
}) {
  const { showToast } = useToast();
  const [fecha, setFecha] = useState(cajaFechaHoy);
  const [tipo, setTipo] = useState("ingreso");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("ninguno");
  const [esPersonal, setEsPersonal] = useState(vista === "personal");
  const [medio, setMedio] = useState("efectivo");
  const [customMedio, setCustomMedio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estadoComprobante, setEstadoComprobante] = useState<EstadoArchivoUpload>("idle");
  const comprobanteActual = useRef<EstadoArchivoUpload>("idle");
  const cambiarEstadoComprobante = useCallback((estado: EstadoArchivoUpload) => {
    comprobanteActual.current = estado;
    setEstadoComprobante(estado);
  }, []);
  const [enviar] = useState(() => crearEnvioCaja(submitCajaMovimientoForm));

  const [state, formAction, pending] = useActionState(
    async (_p: MutationFormState, formData: FormData) => {
      if (comprobanteActual.current === "subiendo" || comprobanteActual.current === "error") {
        return { success: false, error: "Espera a que el comprobante termine de subir. Si falló, vuelve a seleccionarlo.", message: null };
      }
      onPendingChange(true);
      try {
        return await enviar(_p, formData);
      } finally {
        onPendingChange(false);
      }
    },
    mutationFormInitialState,
  );
  const importe = parseCajaMonto(monto);
  const destino = esPersonal ? "Personal" : "Empresa";
  const medioVisible = medio === "otro" ? customMedio.trim() || "Medio por especificar" : cajaMedioLabel(medio);

  useEffect(() => {
    if (state.success && state.message) {
      showToast({ variant: "success", message: state.message });
      onCloseAndReset();
    } else if (state.error) {
      showToast({ variant: "error", message: state.error });
    }
  }, [state, showToast, onCloseAndReset]);

  return (
    // El cierre reinicia el panel. Un resultado con error debe conservar todos los campos.
    <form action={formAction} onReset={event => event.preventDefault()} onSubmit={event => {
      if (comprobanteActual.current === "subiendo" || comprobanteActual.current === "error") event.preventDefault();
    }} className="space-y-3">
      <fieldset disabled={pending} className="grid gap-3 md:grid-cols-2">
        <Field name="fecha" type="date" label="Fecha" value={fecha} onChange={event => setFecha(event.target.value)} required />

        <SelectField name="tipo" label="Tipo de movimiento" required value={tipo} onChange={event => setTipo(event.target.value)}>
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Gasto</option>
        </SelectField>

        <div className="space-y-1.5">
          <SelectField name="es_personal" label="Registrar en" value={String(esPersonal)} onChange={event => setEsPersonal(event.target.value === "true")} aria-describedby="caja-destino-ayuda">
            <option value="false">Empresa</option>
            <option value="true">Personal</option>
          </SelectField>
          <p id="caja-destino-ayuda" className="text-xs text-[var(--color-text-secondary)]">
            {esPersonal ? "Se guarda en Personal y no cambia el saldo de Empresa." : "Se guarda en Empresa y actualiza su saldo."}
          </p>
        </div>

        <SelectField
          name="medio"
          label="Medio de pago"
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
            label="Otro medio de pago"
            placeholder="Ej: Plin, Tarjeta, etc."
            value={customMedio}
            onChange={(e) => setCustomMedio(e.target.value)}
            required
          />
        )}

        <Field name="categoria" label="Categoría" placeholder={tipo === "ingreso" ? "Ej.: cobro de cliente" : "Ej.: pago de servicios"} value={categoria} onChange={event => setCategoria(event.target.value)} minLength={2} required />
        <Field name="monto" label="Monto (S/)" type="number" inputMode="decimal" min="0.01" max={CAJA_MONTO_MAXIMO} step="0.01" value={monto} onChange={event => setMonto(event.target.value)} required />

        <Field
          label="Descripción (opcional)"
          placeholder="Detalle opcional"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <input
          type="hidden"
          name="descripcion"
          value={medio === "otro" && customMedio.trim() ? `[Medio: ${customMedio.trim()}] ${descripcion}` : descripcion}
        />

        <SelectField name="tipo_comprobante" label="Tipo de comprobante" value={tipoComprobante} onChange={event => setTipoComprobante(event.target.value)} required>
          <option value="ninguno">Sin comprobante</option>
          <option value="factura">Factura</option>
          <option value="boleta">Boleta</option>
        </SelectField>

        <div className="md:col-span-2">
          <FotoUpload
            bucket="caja"
            name="url_comprobante"
            label="Adjuntar comprobante (PNG/JPG/PDF, opcional)"
            onStateChange={cambiarEstadoComprobante}
          />
          {estadoComprobante === "subiendo" ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Espera a que termine la subida para registrar el movimiento.</p> : null}
          {estadoComprobante === "error" ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Vuelve a seleccionar el comprobante antes de registrar. Los demás datos se conservan.</p> : null}
        </div>
        <div role="status" aria-label="Resumen del nuevo movimiento" className="md:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-3 space-y-1">
          <p className="text-sm font-semibold">Antes de guardar</p>
          <p className="text-sm">{tipo === "ingreso" ? "Ingreso" : "Gasto"} · {importe === null ? "Monto por completar" : formatPen(importe)} · {destino}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Fecha: {fecha ? formatDate(fecha) : "Por completar"} · Medio: {medioVisible}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {importe === null ? "Escribe un monto mayor que cero, con hasta 2 decimales, para revisar el efecto en el saldo." : `${tipo === "ingreso" ? "Sumará" : "Restará"} ${formatPen(importe)} al saldo de ${destino}.${esPersonal ? " El saldo de Empresa no cambia." : ""}`}
          </p>
        </div>
        {state.error && <p role="alert" className="md:col-span-2 text-sm text-[var(--color-danger)]">{state.error}</p>}
        <div className="md:col-span-2">
          <PendingSubmitButton idleText="Registrar movimiento" disabled={estadoComprobante === "subiendo" || estadoComprobante === "error"} />
        </div>
      </fieldset>
    </form>
  );
}

export function CajaContextPanels({ vista = "empresa" }: { vista?: CajaVista }) {
  const [movOpen, setMovOpen] = useState(false);
  const [movFormKey, setMovFormKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const closeMov = useCallback(() => {
    setMovOpen(false);
    setMovFormKey((k) => k + 1);
  }, []);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar movimiento"
        title="Nuevo movimiento de caja"
        description="Elige dónde registrarlo y revisa el efecto en el saldo antes de guardar."
        open={movOpen}
        busy={saving}
        onOpenChange={(next) => {
          if (!next && saving) return;
          setMovOpen(next);
          if (!next) setMovFormKey((k) => k + 1);
        }}
      >
        <CajaMovimientoForm key={`${vista}-${movFormKey}`} onCloseAndReset={closeMov} vista={vista} onPendingChange={setSaving} />
      </ContextActionPanel>
    </>
  );
}
