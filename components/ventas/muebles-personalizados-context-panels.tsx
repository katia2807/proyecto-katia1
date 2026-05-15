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



  const [openApr, setOpenApr] = useState(false);
  const [aprKey, setAprKey] = useState(0);
  const [stateApr, actionApr] = useActionState(submitAprobarCotizacionForm, mutationFormInitialState);

  useEffect(() => {
    if (stateApr.success && stateApr.message) {
      showToast({ variant: "success", message: stateApr.message });
      setOpenApr(false);
      setAprKey((k) => k + 1);
    } else if (stateApr.error) {
      showToast({ variant: "error", message: stateApr.error });
    }
  }, [stateApr, showToast]);

  const cotizacionAprOptions = useMemo(() => {
    const src = mockData ? MOCK_COTIZACIONES_APROBACION : opcionesAprobacion;
    return src.map((o) => ({
      value: o.id,
      label: o.label,
    }));
  }, [mockData, opcionesAprobacion]);

  return (
    <>
      <Link href="/cotizacion">
        <Button type="button" variant="primary">
          Nueva cotización
        </Button>
      </Link>

      <ContextActionPanel
        triggerLabel="Aceptar (orden + adelanto)"
        title="Aceptar cotización confirmada"
        description="En un solo paso: crea la orden de producción y registra el adelanto en caja."
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
