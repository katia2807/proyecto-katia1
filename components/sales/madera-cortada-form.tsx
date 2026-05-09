"use client";

import { useMemo, useState } from "react";
import { EntregaFormFields } from "@/components/sales/entrega-form-fields";
import { PagoFormFields } from "@/components/sales/pago-form-fields";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { formatPen } from "@/lib/utils";
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
  action: (formData: FormData) => Promise<void>;
  clientes: Cliente[];
  choferes: Chofer[];
  productos: Producto[];
  zonas?: Pick<ZonaEntregaRow, "id" | "nombre" | "tarifa" | "distancia_km">[];
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

export function MaderaCortadaForm({ action, clientes, choferes, productos, zonas = [] }: MaderaCortadaFormProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [cantidad, setCantidad] = useState(1);
  const [espesor, setEspesor] = useState(2);
  const [ancho, setAncho] = useState(6);
  const [largo, setLargo] = useState(8);
  const [precioPorPt, setPrecioPorPt] = useState(0);
  const [productoId, setProductoId] = useState("");

  const totalPt = useMemo(() => calcularPT(cantidad, espesor, ancho, largo), [cantidad, espesor, ancho, largo]);
  const totalSoles = useMemo(() => totalPt * precioPorPt, [totalPt, precioPorPt]);
  const productoSeleccionado = productos.find((p) => p.id === productoId);
  const sinStock =
    productoSeleccionado && Number(productoSeleccionado.stock_actual) <= 0;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField name="cliente_id" label="Cliente" defaultValue="" required>
          <option value="" disabled>
            Selecciona cliente
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </SelectField>
        <Field name="fecha" type="date" label="Fecha" defaultValue={hoy} required />
        <SelectField name="tipo_corte" label="Tipo de corte" defaultValue="tabla">
          {tiposCorte.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="inventario_producto_id"
          label="Producto en inventario (opcional)"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
        >
          <option value="">Sin descontar inventario</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · stock {Number(p.stock_actual).toFixed(2)} {p.unidad}
            </option>
          ))}
        </SelectField>
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
          <EntregaFormFields choferes={choferes} zonas={zonas} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          Datos de pago
        </p>
        <div className="mt-2">
          <PagoFormFields />
        </div>
      </div>

      <Button>Confirmar venta</Button>
    </form>
  );
}
