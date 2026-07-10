"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Button } from "@/components/ui/button";
import { formatPen, roundMoney } from "@/lib/utils";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";

type Cliente = { id: string; nombre: string; documento?: string | null; ruc?: string | null };

type AserraderoEditarFormProps = {
  servicio: {
    id: string;
    cliente_id: string;
    fecha: string;
    pies_cubicos: number;
    costo_cubicaje: number;
    precio_cobrado: number;
    utilidad: number;
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
  const [piesCubicos, setPiesCubicos] = useState(Number(servicio.pies_cubicos));
  const [costoCubicaje, setCostoCubicaje] = useState(Number(servicio.costo_cubicaje));
  const [precioCobrado, setPrecioCobrado] = useState(Number(servicio.precio_cobrado));

  // Recalculate utility in live mode: utilidad = roundMoney(precio_cobrado - costo_cubicaje)
  const utilidad = useMemo(() => {
    return roundMoney(precioCobrado - costoCubicaje);
  }, [precioCobrado, costoCubicaje]);

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
      <input type="hidden" name="lineas_json" value={typeof servicio.lineas_json === "string" ? servicio.lineas_json : JSON.stringify(servicio.lineas_json)} />

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
          onChange={(e) => setPiesCubicos(Number(e.target.value))}
          required
        />

        <Field
          name="costo_cubicaje"
          type="number"
          step="0.01"
          min="0"
          label="Costo Cubicaje (S/) *"
          value={costoCubicaje}
          onChange={(e) => setCostoCubicaje(Number(e.target.value))}
          required
        />

        <Field
          name="precio_cobrado"
          type="number"
          step="0.01"
          min="0"
          label="Precio Cobrado (S/) *"
          value={precioCobrado}
          onChange={(e) => setPrecioCobrado(Number(e.target.value))}
          required
        />
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-2">Cálculo de Utilidad Estimada</h4>
        <div className="grid gap-2 text-xs md:grid-cols-3 text-[var(--color-text-secondary)]">
          <div>
            <p>Precio Cobrado: <strong className="text-[var(--color-text-primary)]">{formatPen(precioCobrado)}</strong></p>
          </div>
          <div>
            <p>Costo Cubicaje: <strong className="text-[var(--color-text-primary)]">{formatPen(costoCubicaje)}</strong></p>
          </div>
          <div>
            <p>
              Utilidad Recalculada:{" "}
              <span className={`font-bold ${utilidad >= 0 ? "text-[var(--color-success)]" : "text-red-500"}`}>
                {formatPen(utilidad)}
              </span>
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
