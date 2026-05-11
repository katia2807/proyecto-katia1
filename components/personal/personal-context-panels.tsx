"use client";

import { createAdelanto, createEmpleado, createSueldo } from "@/app/actions";
import { ContextActionPanel } from "@/components/context-action-panel";
import { Combobox } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { MOCK_EMPLEADOS } from "@/lib/combobox-mocks";
import { useMemo, useState } from "react";

type EmpleadoOpt = { id: string; nombre: string };

type PersonalContextPanelsProps = {
  empleados: EmpleadoOpt[];
  mockData?: boolean;
};

export function PersonalContextPanels({ empleados, mockData = false }: PersonalContextPanelsProps) {
  const [empleadoAdelantoId, setEmpleadoAdelantoId] = useState("");
  const [empleadoSueldoId, setEmpleadoSueldoId] = useState("");

  const empleadoOptions = useMemo(() => {
    const src = mockData ? MOCK_EMPLEADOS : empleados;
    return src.map((e) => ({
      value: e.id,
      label: e.nombre,
    }));
  }, [mockData, empleados]);

  return (
    <>
      <ContextActionPanel
        triggerLabel="Registrar empleado"
        title="Nuevo empleado"
        description="Alta rápida del personal activo."
      >
        <form action={createEmpleado} className="space-y-3">
          <Field name="nombre" label="Nombre completo" required />
          <Field name="rol" label="Rol" placeholder="Chofer / Operario" required />
          <Field name="fecha_ingreso" type="date" label="Fecha de ingreso" required />
          <PendingSubmitButton idleText="Guardar empleado" />
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        triggerLabel="Registrar adelanto"
        title="Nuevo adelanto"
        description="Registra monto y fecha para el empleado seleccionado."
      >
        <form action={createAdelanto} className="space-y-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Empleado</span>
            <Combobox
              options={empleadoOptions}
              value={empleadoAdelantoId}
              onChange={setEmpleadoAdelantoId}
              hiddenInputName="empleado_id"
              placeholder="Buscar empleado…"
              inputAriaLabel="Empleado para adelanto"
            />
          </label>
          <Field name="fecha" label="Fecha" type="date" required />
          <Field name="monto" label="Monto (S/)" type="number" step="0.01" min="0" required />
          <PendingSubmitButton idleText="Registrar adelanto" />
        </form>
      </ContextActionPanel>

      <ContextActionPanel
        triggerLabel="Registrar sueldo"
        title="Nuevo sueldo"
        description="Neto = bruto - descuentos, sin doble conteo en reportes."
      >
        <form action={createSueldo} className="space-y-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
            <span>Empleado</span>
            <Combobox
              options={empleadoOptions}
              value={empleadoSueldoId}
              onChange={setEmpleadoSueldoId}
              hiddenInputName="empleado_id"
              placeholder="Buscar empleado…"
              inputAriaLabel="Empleado para sueldo"
            />
          </label>
          <Field name="periodo" label="Periodo (YYYY-MM)" placeholder="2026-04" required />
          <Field name="monto_bruto" label="Bruto (S/)" type="number" step="0.01" min="0" required />
          <Field name="descuentos" label="Descuentos (S/)" type="number" step="0.01" min="0" defaultValue="0" />
          <PendingSubmitButton idleText="Guardar sueldo" />
        </form>
      </ContextActionPanel>
    </>
  );
}
