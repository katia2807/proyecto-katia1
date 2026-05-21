"use client";

import { submitCreateVentaMaderaCortadaForm } from "@/app/actions";
import { useMemo, useState, useEffect, useActionState } from "react";
import { EntregaFormFields } from "@/components/sales/entrega-form-fields";
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { NuevoClienteInlinePanel } from "@/components/sales/nuevo-cliente-inline-panel";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/Combobox";
import { ClienteCombobox } from "@/components/ui/cliente-combobox";
import { Field, SelectField } from "@/components/ui/field";
import { liteClientesToCompleto, MOCK_INVENTARIO_PRODUCTOS } from "@/lib/combobox-mocks";
import { formatPen } from "@/lib/utils";
import { mutationFormInitialState } from "@/lib/mutation-form-state";
import type { ZonaEntregaRow } from "@/lib/demo-store";

type Cliente = { id: string; nombre: string };
type Chofer = { id: string; nombre: string; telefono?: string | null; placa?: string | null };
type Producto = {
  id: string;
  nombre: string;
  unidad: string;
  stock_actual: number | string;
  categoria: string;
};

type MaderaCortadaFormProps = {
  clientes: Cliente[];
  choferes: Chofer[];
  productos: Producto[];
  zonas?: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
  mockData?: boolean;
  /** Callback que se dispara cuando la venta se guardó con éxito (para cerrar el modal). */
  onSuccess?: () => void;
};

const tiposCorte = [
  { value: "tabla", label: "Tabla" },
  { value: "liston", label: "Listón" },
  { value: "cuarton", label: "Cuartón" },
  { value: "poste", label: "Poste" },
] as const;

function calcularPT(cantidad: number, espesor: number, ancho: number, largo: number) {
  return (cantidad * espesor * ancho * largo) / 12;
}

export function MaderaCortadaForm({
  clientes,
  choferes,
  productos,
  zonas = [],
  mockData = false,
  onSuccess,
}: MaderaCortadaFormProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [clienteId, setClienteId] = useState("");
  const [clientesLocales, setClientesLocales] = useState<Cliente[]>([]);
  const [modoCliente, setModoCliente] = useState<"buscar" | "nuevo" | "temporal">("buscar");
  const [cantidad, setCantidad] = useState(1);
  const [espesor, setEspesor] = useState(2);
  const [ancho, setAncho] = useState(6);
  const [largo, setLargo] = useState(8);
  const [precioPorPt, setPrecioPorPt] = useState(0);
  const [productoId, setProductoId] = useState("");

  const totalPt = useMemo(() => calcularPT(cantidad, espesor, ancho, largo), [cantidad, espesor, ancho, largo]);
  const totalSoles = useMemo(() => totalPt * precioPorPt, [totalPt, precioPorPt]);

  // useActionState para detectar éxito y cerrar automáticamente
  const [state, formAction] = useActionState(submitCreateVentaMaderaCortadaForm, mutationFormInitialState);

  useEffect(() => {
    if (state?.success && onSuccess) {
      onSuccess();
    }
  }, [state, onSuccess]);

  const todosLosClientes = useMemo(() => [...clientes, ...clientesLocales], [clientes, clientesLocales]);

  const effectiveProductos = useMemo((): Producto[] => {
    if (!mockData) return productos;
    return MOCK_INVENTARIO_PRODUCTOS.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      stock_actual: p.stock_actual,
      categoria: p.categoria,
    }));
  }, [mockData, productos]);

  const clientesCombo = useMemo(() => liteClientesToCompleto(todosLosClientes), [todosLosClientes]);

  const productoComboOptions = useMemo(
    () => [
      { value: "", label: "Sin descontar inventario", sublabel: undefined as string | undefined },
      ...effectiveProductos.map((p) => ({
        value: p.id,
        label: p.nombre,
        sublabel: `stock ${Number(p.stock_actual).toFixed(2)} ${p.unidad}`,
      })),
    ],
    [effectiveProductos],
  );

  const productoSeleccionado = effectiveProductos.find((p) => p.id === productoId);
  const sinStock =
    productoSeleccionado && Number(productoSeleccionado.stock_actual) <= 0;

  function handleClienteCreado(id: string, nombre: string) {
    setClientesLocales((prev) => [...prev, { id, nombre }]);
    setClienteId(id);
    setModoCliente("buscar");
  }

  return (
    <form action={formAction} className="space-y-4">
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
                inputAriaLabel="Cliente para venta de madera cortada"
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

        <Field name="fecha" type="date" label="Fecha" defaultValue={hoy} required />
        <SelectField name="tipo_corte" label="Tipo de corte" defaultValue="tabla">
          {tiposCorte.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
          <span>Producto en inventario (opcional)</span>
          <Combobox
            options={productoComboOptions}
            value={productoId}
            onChange={setProductoId}
            hiddenInputName="inventario_producto_id"
            placeholder="Buscar producto o dejar sin inventario…"
            inputAriaLabel="Producto de inventario para descontar stock"
          />
        </label>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Calculadora de pies tablares
        </p>
        <div className="mt-2 grid gap-3 md:grid-cols-4">
          <Field
            label="Cantidad"
            type="number"
            min="0"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value) || 0)}
          />
          <Field
            label="Espesor (in)"
            type="number"
            min="0"
            step="0.01"
            value={espesor}
            onChange={(e) => setEspesor(Number(e.target.value) || 0)}
          />
          <Field
            label="Ancho (in)"
            type="number"
            min="0"
            step="0.01"
            value={ancho}
            onChange={(e) => setAncho(Number(e.target.value) || 0)}
          />
          <Field
            label="Largo (ft)"
            type="number"
            min="0"
            step="0.01"
            value={largo}
            onChange={(e) => setLargo(Number(e.target.value) || 0)}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            <p className="text-xs text-[var(--color-text-secondary)]">Total PT</p>
            <p className="text-xl font-bold">{totalPt.toFixed(2)}</p>
          </div>
          <Field
            label="Precio por PT (S/)"
            type="number"
            min="0"
            step="0.01"
            value={precioPorPt}
            onChange={(e) => setPrecioPorPt(Number(e.target.value) || 0)}
          />
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/40 p-2">
            <p className="text-xs text-[var(--color-text-secondary)]">Total venta</p>
            <p className="text-2xl font-black text-[var(--color-text-primary)]">
              {formatPen(totalSoles)}
            </p>
          </div>
        </div>
        {sinStock ? (
          <p className="mt-2 text-xs font-semibold text-[var(--color-danger)]">
            ⚠ El producto seleccionado no tiene stock disponible.
          </p>
        ) : null}
      </div>

      <input type="hidden" name="total_pt" value={totalPt.toFixed(4)} />
      <input type="hidden" name="precio_por_pt" value={precioPorPt} />
      <input type="hidden" name="total" value={totalSoles.toFixed(2)} />

      <div className="rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Datos de entrega
        </p>
        <div className="mt-2">
          <EntregaFormFields mockData={mockData} choferes={choferes} zonas={zonas} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Datos de pago
        </p>
        <div className="mt-2">
          <PagoFormFields showAdelantoInput={true} />
        </div>
      </div>

      {state?.error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{state.error}</p>
      ) : null}

      <Button>Confirmar venta</Button>
    </form>
  );
}
