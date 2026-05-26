"use client";

import { submitAprobarCotizacionForm, submitCreateCotizacionForm } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { NotasSelector } from "@/components/sales/notas-selector";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { Field, SelectField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { liteClientesToCompleto, MOCK_COTIZACIONES_APROBACION } from "@/lib/combobox-mocks";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState, useActionState } from "react";
import Link from "next/link";

type FormActionProp = Exclude<ComponentProps<"form">["action"], string | undefined>;

type ClienteOpt = { id: string; nombre: string };
type AprobableOpt = { id: string; label: string };

type MueblesPersonalizadosContextPanelsProps = {
  clientes: ClienteOpt[];
  opcionesAprobacion: AprobableOpt[];
  mockData?: boolean;
};



function CrearCotizacionRapidaFormFields({
  clienteOptions,
  formAction,
}: {
  clienteOptions: { value: string; label: string }[];
  formAction: FormActionProp;
}) {
  const [clienteId, setClienteId] = useState("");
  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <form action={formAction} className="grid gap-3">
      {/* Tipo oculto */}
      <input type="hidden" name="tipo" value="mueble_personalizado" />

      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
        <span>Cliente</span>
        <Combobox
          options={clienteOptions}
          value={clienteId}
          onChange={setClienteId}
          hiddenInputName="cliente_id"
          placeholder="Buscar cliente…"
          inputAriaLabel="Cliente para la cotización"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          name="fecha"
          label="Fecha"
          type="date"
          defaultValue={hoy}
          required
        />
        <Field
          name="especie_madera"
          label="Especie de madera"
          placeholder="Ej. Tornillo, Cedro, Caoba..."
          required
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField name="unidad_medida" label="Unidad de medida" defaultValue="cm">
          <option value="cm">Centímetros (cm)</option>
          <option value="in">Pulgadas (in)</option>
          <option value="otro">Otro</option>
        </SelectField>
        <SelectField name="estado" label="Estado" defaultValue="confirmada">
          <option value="confirmada">Confirmada (Lista para producción)</option>
          <option value="borrador">Borrador</option>
        </SelectField>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          name="precio_calculado"
          label="Precio Calculado (S/)"
          type="number"
          min="0"
          step="0.01"
          required
        />
        <Field
          name="precio_acordado"
          label="Precio Acordado (S/)"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </div>

      <Field
        name="motivo_ajuste"
        label="Motivo del ajuste (opcional)"
        placeholder="Ej. Descuento por volumen, cliente recurrente..."
      />

      <Button>Guardar Cotización</Button>
    </form>
  );
}

function AceptarCotizacionFormFields({
  cotizacionAprOptions,
  formAction,
}: {
  cotizacionAprOptions: { value: string; label: string }[];
  formAction: FormActionProp;
}) {
  const [cotizacionAprId, setCotizacionAprId] = useState("");

  return (
    <form action={formAction} className="grid gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
        <span>Cotización</span>
        <Combobox
          options={cotizacionAprOptions}
          value={cotizacionAprId}
          onChange={setCotizacionAprId}
          hiddenInputName="cotizacion_id"
          placeholder="Buscar cotización confirmada…"
          inputAriaLabel="Cotización para pasar a orden"
        />
      </label>
      <Field
        name="notas"
        label="Notas para el taller"
        placeholder="Acabado, materiales, fechas estimadas…"
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          name="adelanto"
          label="Adelanto cobrado (S/) — opcional"
          type="number"
          min="0"
          step="0.01"
          defaultValue="0"
        />
        <SelectField name="metodo_adelanto" label="Medio del adelanto" defaultValue="efectivo">
          <option value="efectivo">Efectivo</option>
          <option value="yape">Yape</option>
          <option value="banco">Banco</option>
          <option value="otro">Otro</option>
        </SelectField>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Si dejas el adelanto en 0, solo se crea la orden. Si pones un monto &gt; 0, se asienta como
        ingreso en caja con la categoría
        <strong> adelanto_mueble_personalizado</strong>.
      </p>
      <Button>Aceptar cotización</Button>
    </form>
  );
}

export function MueblesPersonalizadosContextPanels({
  clientes,
  opcionesAprobacion,
  mockData = false,
}: MueblesPersonalizadosContextPanelsProps) {
  const { showToast } = useToast();

  const [openCreate, setOpenCreate] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [stateCreate, actionCreate] = useActionState(submitCreateCotizacionForm, mutationFormInitialState);

  const [openApr, setOpenApr] = useState(false);
  const [aprKey, setAprKey] = useState(0);
  const [stateApr, actionApr] = useActionState(submitAprobarCotizacionForm, mutationFormInitialState);

  useEffect(() => {
    if (stateCreate.success && stateCreate.message) {
      showToast({ variant: "success", message: stateCreate.message });
      setOpenCreate(false);
      setCreateKey((k) => k + 1);
      window.location.reload();
    } else if (stateCreate.error) {
      showToast({ variant: "error", message: stateCreate.error });
    }
  }, [stateCreate, showToast]);

  useEffect(() => {
    if (stateApr.success && stateApr.message) {
      showToast({ variant: "success", message: stateApr.message });
      setOpenApr(false);
      setAprKey((k) => k + 1);
      window.location.reload();
    } else if (stateApr.error) {
      showToast({ variant: "error", message: stateApr.error });
    }
  }, [stateApr, showToast]);

  const clienteOptions = useMemo(() => {
    return clientes.map((c) => ({
      value: c.id,
      label: c.nombre,
    }));
  }, [clientes]);

  const cotizacionAprOptions = useMemo(() => {
    const src = mockData ? MOCK_COTIZACIONES_APROBACION : opcionesAprobacion;
    return src.map((o) => ({
      value: o.id,
      label: o.label,
    }));
  }, [mockData, opcionesAprobacion]);

  return (
    <>
      {/* Botón principal: ir al cotizador inteligente */}
      <Link href="/cotizacion">
        <Button type="button" variant="primary">
          🧠 Cotizador inteligente
        </Button>
      </Link>

      {/* Botón 2: Formulario rápido de cotización simple */}
      <ContextActionPanel
        triggerLabel="Cotización rápida"
        title="Nueva cotización rápida"
        description="Registro simplificado: solo cliente, especie, precio calculado y acordado. Para cotizaciones con muebles diseñados externamente."
        open={openCreate}
        onOpenChange={(next) => {
          setOpenCreate(next);
          if (!next) setCreateKey((k) => k + 1);
        }}
      >
        <CrearCotizacionRapidaFormFields key={createKey} clienteOptions={clienteOptions} formAction={actionCreate} />
      </ContextActionPanel>

      {/* Botón 3: Aprobar cotización → crear orden de producción + registrar adelanto */}
      <ContextActionPanel
        triggerLabel="Aprobar → Orden + Adelanto"
        title="Aprobar cotización confirmada"
        description="En un solo paso: crea la orden de producción y registra el adelanto en caja. Solo aplica a cotizaciones con estado 'Confirmada'."
        open={openApr}
        onOpenChange={(next) => {
          setOpenApr(next);
          if (!next) setAprKey((k) => k + 1);
        }}
      >
        <AceptarCotizacionFormFields key={aprKey} cotizacionAprOptions={cotizacionAprOptions} formAction={actionApr} />
      </ContextActionPanel>
    </>
  );
}
