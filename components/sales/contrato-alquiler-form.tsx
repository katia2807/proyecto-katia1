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
  const [clienteId, setClienteId] = useState("");
  const [clientesLocales, setClientesLocales] = useState<{ id: string; nombre: string; ruc?: string | null }[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");
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

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  return (
    <form action={panelAction} className="space-y-4">
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
                inputAriaLabel="Cliente para contrato de alquiler"
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

        <Field name="codigo" label="Código de contrato" placeholder="CT-2026-0001" />
        <Field name="activo" label="Activo / equipo" placeholder="Bomba Mixer" required />
        <Field
          name="representante"
          label="Representante de la empresa"
          placeholder="Ing. responsable"
        />
        <Field
          name="ruc_empresa"
          label="RUC de la empresa"
          placeholder="20XXXXXXXXX"
          inputMode="numeric"
          maxLength={11}
        />
        <Field
          className="md:col-span-2"
          name="direccion_ejecucion"
          label="Dirección de ejecución de obra"
          placeholder="Av. / Mz. y Lt."
        />
        <Field
          name="fecha_inicio"
          label="Fecha de inicio"
          type="date"
          defaultValue={hoy}
          required
        />
        <Field name="fecha_termino" label="Fecha de término estimada" type="date" />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Tarifa y monto
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
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
          <Field
            name="tarifa"
            label={`Tarifa (S/ por ${tarifaUnidad === "hora_maquina" ? "hora" : tarifaUnidad === "m3" ? "m³" : "día"})`}
            type="number"
            min="0"
            step="0.01"
            value={tarifa}
            onChange={(e) => setTarifa(Number(e.target.value) || 0)}
            required
          />
          <Field
            name="dias_alquiler"
            label={labelCantidad(tarifaUnidad)}
            type="number"
            min="1"
            step="1"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value) || 0)}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
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

      <div className="rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Datos de pago
        </p>
        <div className="mt-2">
          <PagoFormFields defaultModalidadPago="adelanto" />
        </div>
      </div>

      <Button size="lg" className="w-full mt-4 shadow-lg shadow-[var(--color-primary)]/25 hover:shadow-[var(--color-primary)]/35 transition-all">
        Registrar contrato
      </Button>
    </form>
  );
}
