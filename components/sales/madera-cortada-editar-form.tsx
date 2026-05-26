"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Button } from "@/components/ui/button";
import { formatPen, roundMoney } from "@/lib/utils";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

type Cliente = { id: string; nombre: string; documento?: string | null; ruc?: string | null };

const TIPO_CORTE_OPTIONS = [
  { value: "tabla", label: "Tabla" },
  { value: "liston", label: "Listón" },
  { value: "cuarton", label: "Cuartón" },
  { value: "poste", label: "Poste" },
] as const;

type TipoCorte = "tabla" | "liston" | "cuarton" | "poste";

type MaderaCortadaEditarFormProps = {
  venta: {
    id: string;
    cliente_id: string;
    fecha: string;
    tipo_corte: string | null;
    total_pt: number;
    precio_por_pt: number;
    total: number;
    metodo_pago?: string | null;
    modalidad_pago?: string | null;
  };
  clientes: Cliente[];
  mockData?: boolean;
  panelAction: (formData: FormData) => void;
};

export function MaderaCortadaEditarForm({
  venta,
  clientes,
  mockData = false,
  panelAction,
}: MaderaCortadaEditarFormProps) {
  const [clienteId, setClienteId] = useState(venta.cliente_id);
  const [fecha, setFecha] = useState(venta.fecha);
  const [tipoCorte, setTipoCorte] = useState<TipoCorte>(
    (venta.tipo_corte as TipoCorte) ?? "tabla",
  );
  const [totalPt, setTotalPt] = useState(Number(venta.total_pt));
  const [precioPorPt, setPrecioPorPt] = useState(Number(venta.precio_por_pt));

  const total = useMemo(() => roundMoney(totalPt * precioPorPt), [totalPt, precioPorPt]);

  const clientOpts = useMemo(
    () =>
      clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        documento: c.documento ?? null,
        telefono: null,
        direccion: null,
        ruc: c.ruc ?? null,
      })),
    [clientes],
  );

  return (
    <form action={panelAction} className="space-y-6">
      <input type="hidden" name="id" value={venta.id} />
      <input type="hidden" name="total" value={total} />
      <input type="hidden" name="metodo_pago" value={venta.metodo_pago ?? "efectivo"} />
      <input type="hidden" name="modalidad_pago" value={venta.modalidad_pago ?? "contado"} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <ClienteCombobox
            mockData={mockData}
            clientes={clientOpts}
            value={clienteId}
            onChange={setClienteId}
            hiddenInputName="cliente_id"
            label="Cliente *"
            placeholder="Buscar cliente…"
          />
        </div>

        <Field
          name="fecha"
          type="date"
          label="Fecha *"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            Tipo de Corte *
          </label>
          <select
            name="tipo_corte"
            value={tipoCorte}
            onChange={(e) => setTipoCorte(e.target.value as TipoCorte)}
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {TIPO_CORTE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Field
          name="total_pt"
          type="number"
          step="0.01"
          min="0.01"
          label="Total Pies Tablares (PT) *"
          value={totalPt}
          onChange={(e) => setTotalPt(Number(e.target.value))}
          required
        />

        <Field
          name="precio_por_pt"
          type="number"
          step="0.01"
          min="0"
          label="Precio por PT (S/) *"
          value={precioPorPt}
          onChange={(e) => setPrecioPorPt(Number(e.target.value))}
          required
        />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-2">Resumen de Venta</h4>
        <div className="grid gap-2 text-xs md:grid-cols-3 text-[var(--color-text-secondary)]">
          <div>
            <p>
              Total PT:{" "}
              <strong className="text-[var(--color-text-primary)]">
                {totalPt.toFixed(2)} PT
              </strong>
            </p>
          </div>
          <div>
            <p>
              Precio por PT:{" "}
              <strong className="text-[var(--color-text-primary)]">
                {formatPen(precioPorPt)}
              </strong>
            </p>
          </div>
          <div>
            <p>
              Total Calculado:{" "}
              <span className="font-bold text-[var(--color-success)]">{formatPen(total)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" type="button" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <PendingSubmitButton idleText="Guardar Cambios" />
      </div>
    </form>
  );
}
