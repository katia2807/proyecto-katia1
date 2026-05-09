"use client";

import { useMemo, useState } from "react";
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
  action: (formData: FormData) => Promise<void>;
  contratos: ContratoLite[];
};

export function CierreContratoForm({ action, contratos }: CierreContratoFormProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [contratoId, setContratoId] = useState(contratos[0]?.id ?? "");
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

  return (
    <form action={action} className="space-y-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Contrato a cerrar
        <select
          name="contrato_id"
          value={contratoId}
          onChange={(e) => setContratoId(e.target.value)}
          required
          className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
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
      </label>

      <Field name="fecha_cierre" type="date" label="Fecha de cierre" defaultValue={hoy} required />
      <Field
        name="observaciones"
        label="Observaciones del retorno"
        placeholder="Estado del equipo, daños, retraso…"
      />

      <fieldset className="rounded-xl border border-[var(--color-border)] p-3">
        <legend className="px-1 text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Penalidades aplicables
        </legend>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="retraso_pago"
            checked={retraso}
            onChange={(e) => setRetraso(e.target.checked)}
          />
          Retraso en el pago ({contrato?.penalidad_retraso_pago_pct ?? 3}%)
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="devolucion_tardia"
            checked={devolucion}
            onChange={(e) => setDevolucion(e.target.checked)}
          />
          Devolución tardía del equipo ({contrato?.penalidad_devolucion_tardia_pct ?? 3}%)
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="danios"
            checked={danios}
            onChange={(e) => setDanios(e.target.checked)}
          />
          Daños al equipo ({contrato?.penalidad_danios_pct ?? 3}%)
        </label>
      </fieldset>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/30 p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">Penalidad total a cobrar</p>
        <p className="text-2xl font-black">{formatPen(penalidadCalc)}</p>
      </div>

      <Button>Cerrar contrato</Button>
    </form>
  );
}
