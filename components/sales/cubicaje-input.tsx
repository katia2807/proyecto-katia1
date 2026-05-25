"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPen } from "@/lib/utils";

type Pieza = {
  id: number;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  descripcion: string;
};

type CubicajeInputProps = {
  /** Nombre del campo oculto donde se guardará el JSON con todas las piezas. */
  name?: string;
  defaultPiezas?: Pieza[];
  /** Precio por pie tablar en S/ para mostrar costo total estimado. */
  precioPorPT?: number;
  /** Mostrar input para precio en lugar de fijarlo. */
  precioEditable?: boolean;
  defaultPrecioPorPT?: string;
  /** Nombre del campo oculto que reporta el total PT calculado. */
  totalPtName?: string;
  /** Nombre del campo oculto que reporta el volumen total en m³. */
  totalM3Name?: string;
  /** Callback opcional para notificar cambios de valores al padre */
  onChange?: (data: { totalPT: number; totalPC: number; precioPorPT: number; totalSoles: number; piezas: Pieza[] }) => void;
};

/**
 * Calcula pies tablares (PT) según fórmula clásica:
 *   PT = cantidad · espesor(in) · ancho(in) · largo(ft) / 12
 * En este sistema todas las dimensiones se ingresan en pulgadas excepto
 * el largo que va en pies (igual al cotizador inteligente existente).
 */
function calcularPT(p: Pieza) {
  return (p.cantidad * p.espesor * p.ancho * p.largo) / 12;
}

/** Convierte PT (pies tablares) a metros cúbicos. 1 PT ≈ 0.002359737 m³. */
function ptAM3(pt: number) {
  return pt * 0.002359737;
}

const inputClass =
  "h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

export function CubicajeInput({
  name = "lineas_cubicaje",
  defaultPiezas,
  precioPorPT,
  precioEditable = true,
  defaultPrecioPorPT = "0",
  totalPtName = "total_pt",
  totalM3Name = "total_m3",
  onChange,
}: CubicajeInputProps) {
  const [piezas, setPiezas] = useState<Pieza[]>(
    defaultPiezas !== undefined
      ? defaultPiezas
      : [{ id: 1, cantidad: 1, espesor: 2, ancho: 6, largo: 8, descripcion: "" }],
  );
  const [precioInput, setPrecioInput] = useState(defaultPrecioPorPT);

  const piezasConSubtotal = useMemo(
    () => piezas.map((p) => ({ ...p, subtotalPT: calcularPT(p) })),
    [piezas],
  );

  const totalPT = useMemo(
    () => piezasConSubtotal.reduce((acc, p) => acc + p.subtotalPT, 0),
    [piezasConSubtotal],
  );

  const totalPC = useMemo(() => totalPT / 12, [totalPT]);
  const totalM3 = useMemo(() => ptAM3(totalPT), [totalPT]);
  const precioActivo = precioEditable
    ? Number.parseFloat(precioInput.replace(",", ".")) || 0
    : (precioPorPT ?? 0);
  const totalSoles = totalPT * precioActivo;

  // Notificar al padre cuando cambien los valores calculados
  useEffect(() => {
    if (onChange) {
      onChange({
        totalPT,
        totalPC,
        precioPorPT: precioActivo,
        totalSoles,
        piezas: piezasConSubtotal.map(p => ({
          ...p,
          descripcion: p.descripcion || ""
        })),
      });
    }
  }, [totalPT, totalPC, precioActivo, totalSoles, piezasConSubtotal, onChange]);

  function agregar() {
    setPiezas((prev) => [
      ...prev,
      { id: (prev.at(-1)?.id ?? 0) + 1, cantidad: 1, espesor: 0, ancho: 0, largo: 0, descripcion: "" },
    ]);
  }

  function eliminar(id: number) {
    setPiezas((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  function actualizar(id: number, patch: Partial<Pieza>) {
    setPiezas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-primary-soft)]/30">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Descripción
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Cant.
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Esp. (in)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Anch. (in)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Largo (ft)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                PT
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {piezasConSubtotal.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-[var(--color-text-secondary)] italic">
                  Calculadora vacía. Selecciona un producto arriba o haz clic en "Agregar pieza" para empezar.
                </td>
              </tr>
            ) : (
              piezasConSubtotal.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-1.5">
                    <input
                      className={inputClass}
                      value={p.descripcion}
                      placeholder="Tabla, listón…"
                      onChange={(e) => actualizar(p.id, { descripcion: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`${inputClass} text-right`}
                      value={p.cantidad}
                      onChange={(e) => actualizar(p.id, { cantidad: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} text-right`}
                      value={p.espesor}
                      onChange={(e) => actualizar(p.id, { espesor: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} text-right`}
                      value={p.ancho}
                      onChange={(e) => actualizar(p.id, { ancho: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} text-right`}
                      value={p.largo}
                      onChange={(e) => actualizar(p.id, { largo: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold">{p.subtotalPT.toFixed(2)}</td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => eliminar(p.id)}
                      className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)]/40 hover:text-[var(--color-danger)]"
                      aria-label="Eliminar pieza"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={agregar} className="h-9 px-3">
          <Plus className="mr-1 size-4" /> Agregar pieza
        </Button>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-lg border border-[var(--color-border)] px-3 py-1.5">
            Total PT: <span className="font-bold">{totalPT.toFixed(2)}</span>
          </span>
          <span className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 bg-[var(--color-primary-soft)]/20 text-[var(--color-primary)]">
            Total Pie Cúbico: <span className="font-bold">{totalPC.toFixed(2)} ft³</span>
          </span>
        </div>
      </div>

      {precioEditable ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Precio por PT (S/)
            <input
              type="number"
              min="0"
              step="0.01"
              name="precio_por_pt"
              value={precioInput}
              onChange={(e) => setPrecioInput(e.target.value)}
              className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </label>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-soft)]/25 p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
              Total estimado
            </p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {formatPen(totalSoles)}
            </p>
          </div>
        </div>
      ) : null}

      <input type="hidden" name={name} value={JSON.stringify(piezasConSubtotal)} />
      <input type="hidden" name={totalPtName} value={totalPT.toFixed(4)} />
      <input type="hidden" name={totalM3Name} value={totalM3.toFixed(6)} />
    </div>
  );
}
