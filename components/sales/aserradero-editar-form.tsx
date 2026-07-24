"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Button } from "@/components/ui/button";
import { formatPen, parseDecimal, roundMoney } from "@/lib/utils";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { buildAserraderoPrintModel } from "@/lib/aserradero-print-model";

type Cliente = { id: string; nombre: string; documento?: string | null; ruc?: string | null };

type AserraderoEditarFormProps = {
  servicio: {
    id: string;
    cliente_id: string;
    fecha: string;
    pies_cubicos: number;
    costo_cubicaje: number;
    precio_cobrado: number;
    lineas_json: any;
  };
  clientes: Cliente[];
  mockData?: boolean;
  panelAction: (formData: FormData) => void;
};

export function AserraderoEditarForm({
  servicio,
  clientes,
  mockData = false,
  panelAction,
}: AserraderoEditarFormProps) {
  const [clienteId, setClienteId] = useState(servicio.cliente_id);
  const [clientesLocales, setClientesLocales] = useState<Cliente[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo">("buscar");
  const [fecha, setFecha] = useState(servicio.fecha);
  const [piesCubicos, setPiesCubicos] = useState(parseDecimal(servicio.pies_cubicos));
  const [costoCubicaje, setCostoCubicaje] = useState(parseDecimal(servicio.costo_cubicaje));
  const [precioCobrado, setPrecioCobrado] = useState(parseDecimal(servicio.precio_cobrado));

  const parsedHistoricalLines = useMemo(() => {
    try {
      const parsed: unknown = typeof servicio.lineas_json === "string"
        ? JSON.parse(servicio.lineas_json)
        : servicio.lineas_json;
      return Array.isArray(parsed)
        ? { valid: true as const, lines: parsed }
        : { valid: false as const, lines: [] as unknown[] };
    } catch {
      return { valid: false as const, lines: [] as unknown[] };
    }
  }, [servicio.lineas_json]);

  const historicalModel = useMemo(
    () => buildAserraderoPrintModel({
      service: servicio,
      tipoComprobante: "boleta",
    }),
    [servicio],
  );
  const [tarifaInput, setTarifaInput] = useState(
    historicalModel.totals.tarifaPorPT === null ? "" : String(historicalModel.totals.tarifaPorPT),
  );
  const canEditTariff =
    historicalModel.totals.tarifaPorPT !== null &&
    historicalModel.totals.totalPTComercial !== null;
  const lineasActualizadas = useMemo(() => {
    if (!parsedHistoricalLines.valid || !canEditTariff) return parsedHistoricalLines.lines;
    const tarifa = parseDecimal(tarifaInput);
    return parsedHistoricalLines.lines.map((line) => {
      if (!line || typeof line !== "object" || Array.isArray(line)) return line;
      const item = line as Record<string, unknown>;
      return item.tipo === "resumen_aserradero" && item.schemaVersion === 1
        ? { ...item, precioPorPT: tarifa }
        : item;
    });
  }, [canEditTariff, parsedHistoricalLines, tarifaInput]);

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);
  const selectedCliente = useMemo(() => todosLosClientes.find((c) => c.id === clienteId), [clienteId, todosLosClientes]);
  const selectedClienteProvisional = Boolean(selectedCliente?.documento?.startsWith("PEND-"));

  const clientOpts = useMemo(() => {
    return todosLosClientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      documento: c.documento ?? null,
      telefono: null,
      direccion: null,
      ruc: c.ruc ?? null,
    }));
  }, [todosLosClientes]);

  function handleClienteCreado(id: string, nombre: string, documento?: string, ruc?: string) {
    setClientesLocales((prev) => [...prev, { id, nombre, documento: documento ?? null, ruc: ruc ?? null }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  return (
    <form action={panelAction} className="space-y-6">
      <input type="hidden" name="id" value={servicio.id} />
      <input
        type="hidden"
        name="lineas_json"
        value={parsedHistoricalLines.valid ? JSON.stringify(lineasActualizadas) : (typeof servicio.lineas_json === "string" ? servicio.lineas_json : JSON.stringify(servicio.lineas_json))}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          {modoCliente === "buscar" ? (
            <>
              <ClienteCombobox
                mockData={mockData}
                clientes={clientOpts}
                value={clienteId}
                onChange={setClienteId}
                hiddenInputName="cliente_id"
                label="Cliente *"
                placeholder="Buscar cliente..."
              />
              {selectedClienteProvisional ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Este servicio esta asociado a un cliente provisional ({selectedCliente?.documento}). Selecciona un cliente real o crea uno nuevo para reemplazarlo.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setModoCliente("nuevo")}
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
              >
                + Nuevo cliente
              </button>
            </>
          ) : (
            <NuevoClienteInlinePanel
              onCreated={handleClienteCreado}
              onCancel={() => setModoCliente("buscar")}
            />
          )}
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
        <Field
          name="pies_cubicos"
          type="number"
          step="0.01"
          min="0"
          label="Pies Cúbicos *"
          value={piesCubicos}
          onChange={(e) => setPiesCubicos(parseDecimal(e.target.value))}
          required
        />

        <Field
          name="costo_cubicaje"
          type="number"
          step="0.01"
          min="0"
          label="Costo Cubicaje (S/) *"
          value={costoCubicaje}
          onChange={(e) => setCostoCubicaje(parseDecimal(e.target.value))}
          required
        />

        <Field
          name="precio_cobrado"
          type="number"
          step="0.01"
          min="0"
          label="Precio Cobrado (S/) *"
          value={precioCobrado}
          onChange={(e) => setPrecioCobrado(parseDecimal(e.target.value))}
          required
        />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-semibold">Tarifa de corte registrada</h4>
        {canEditTariff ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Tarifa de corte por PT
              <input
                type="text"
                inputMode="decimal"
                value={tarifaInput}
                onChange={(event) => {
                  const raw = event.target.value;
                  const tarifa = parseDecimal(raw);
                  setTarifaInput(raw);
                  if (tarifa > 0 && historicalModel.totals.totalPTComercial !== null) {
                    setCostoCubicaje(roundMoney(historicalModel.totals.totalPTComercial * tarifa));
                  }
                }}
                className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
              />
            </label>
            <p className="text-sm">
              {historicalModel.totals.totalPTComercial} PT · Subtotal {formatPen(costoCubicaje)}
            </p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-amber-600">Tarifa no registrada. Se conservan los importes históricos sin recalcular.</p>
        )}
        {!parsedHistoricalLines.valid ? (
          <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs font-semibold text-red-500">
            El detalle histórico contiene JSON inválido. La edición está bloqueada para evitar pérdida de datos.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" type="button" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        {parsedHistoricalLines.valid ? (
          <PendingSubmitButton idleText="Guardar Cambios" />
        ) : (
          <Button type="button" disabled>Guardar Cambios</Button>
        )}
      </div>
    </form>
  );
}
