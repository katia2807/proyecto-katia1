"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
  inventario_producto_id?: string | null;
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
  onChange?: (data: { totalPT: number; totalPC: number; precioPorPT: number; totalSoles: number; piezas: Pieza[]; totalPTComercial?: number }) => void;
  /** Lista opcional de productos de inventario para autocompletar fila por fila */
  productos?: {
    id: string;
    nombre: string;
    unidad: string;
    stock_actual: number | string;
    categoria: string;
    costo_unitario?: number | string | null;
  }[];
};

/**
 * Calcula pies tablares (PT) reales unitarios (para 1 pieza):
 *   PT = espesor(in) · ancho(in) · largo(ft) / 12
 */
function calcularPTUnitarioReal(p: Pieza) {
  return (p.espesor * p.ancho * p.largo) / 12;
}

/** Convierte PT (pies tablares) a metros cúbicos. 1 PT ≈ 0.002359737 m³. */
function ptAM3(pt: number) {
  return pt * 0.002359737;
}

// Analizador de dimensiones física a partir del nombre del producto (compartido)
function parseDimensionesDeNombre(nombre: string) {
  const cleanName = nombre.replace(/\s+/g, " ");
  const threePartMatch = cleanName.match(/(\d+(?:\/\d+)?|\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\/\d+)?|\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\/\d+)?|\d+(?:\.\d+)?)/);
  if (threePartMatch) {
    const parseFractionOrFloat = (str: string) => {
      if (str.includes("/")) {
        const parts = str.split("/");
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(str);
    };
    
    const espesor = parseFractionOrFloat(threePartMatch[1]);
    const ancho = parseFractionOrFloat(threePartMatch[2]);
    let largo = parseFractionOrFloat(threePartMatch[3]);
    if (largo > 20) {
      largo = Math.round(largo / 30); // cm a ft (ej. 240 cm -> 8 pies)
    }
    const descMatch = cleanName.match(/^(.*?)\b\d/);
    const descripcion = descMatch ? descMatch[1].trim() : cleanName;
    return { espesor, ancho, largo, descripcion };
  }
  
  const twoPartMatch = cleanName.match(/(\d+(?:\/\d+)?|\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\/\d+)?|\d+(?:\.\d+)?)/);
  if (twoPartMatch) {
    const parseFractionOrFloat = (str: string) => {
      if (str.includes("/")) {
        const parts = str.split("/");
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      return parseFloat(str);
    };
    const espesor = parseFractionOrFloat(twoPartMatch[1]);
    const ancho = parseFractionOrFloat(twoPartMatch[2]);
    const descMatch = cleanName.match(/^(.*?)\b\d/);
    const descripcion = descMatch ? descMatch[1].trim() : cleanName;
    return { espesor, ancho, largo: 8, descripcion };
  }

  return { espesor: 2, ancho: 6, largo: 8, descripcion: nombre };
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
  productos,
}: CubicajeInputProps) {
  const [piezas, setPiezas] = useState<Pieza[]>(
    defaultPiezas !== undefined
      ? defaultPiezas
      : [{ id: 1, cantidad: 1, espesor: 2, ancho: 6, largo: 8, descripcion: "Tabla", inventario_producto_id: null }],
  );
  const [precioInput, setPrecioInput] = useState(defaultPrecioPorPT);
  const [focusRowId, setFocusRowId] = useState<number | null>(null);

  const piezasConSubtotal = useMemo(
    () => piezas.map((p) => {
      const ptUnitarioReal = calcularPTUnitarioReal(p);
      const ptTotalReal = ptUnitarioReal * p.cantidad;
      const ptUnitarioComercial = Math.floor(ptUnitarioReal);
      const ptTotalComercial = ptUnitarioComercial * p.cantidad;
      return {
        ...p,
        ptUnitarioReal,
        ptTotalReal,
        ptUnitarioComercial,
        ptTotalComercial,
        // Mantener compatibilidad con subtotalPT para no romper esquemas
        subtotalPT: ptTotalReal,
      };
    }),
    [piezas],
  );

  const totalPT = useMemo(
    () => piezasConSubtotal.reduce((acc, p) => acc + p.ptTotalReal, 0),
    [piezasConSubtotal],
  );

  const totalPTComercial = useMemo(
    () => piezasConSubtotal.reduce((acc, p) => acc + p.ptTotalComercial, 0),
    [piezasConSubtotal],
  );

  const totalPC = useMemo(() => totalPT / 12, [totalPT]);
  const totalM3 = useMemo(() => ptAM3(totalPT), [totalPT]);
  const precioActivo = precioEditable
    ? Number.parseFloat(precioInput.replace(",", ".")) || 0
    : (precioPorPT ?? 0);
  
  // Costo comercial se calcula con Total PT comercial * precio por PT
  const totalSoles = totalPTComercial * precioActivo;

  // Notificar al padre cuando cambien los valores calculados
  useEffect(() => {
    if (onChange) {
      onChange({
        totalPT,
        totalPC,
        precioPorPT: precioActivo,
        totalSoles,
        totalPTComercial,
        piezas: piezasConSubtotal.map(p => ({
          ...p,
          descripcion: p.descripcion || "",
          inventario_producto_id: p.inventario_producto_id || null
        })),
      });
    }
  }, [totalPT, totalPC, precioActivo, totalSoles, totalPTComercial, piezasConSubtotal, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      agregar();
    }
  };

  function agregar() {
    const nextId = (piezas.at(-1)?.id ?? 0) + 1;
    setPiezas((prev) => [
      ...prev,
      { id: nextId, cantidad: 1, espesor: 2, ancho: 6, largo: 8, descripcion: "", inventario_producto_id: null },
    ]);
    setFocusRowId(nextId);
  }

  function eliminar(id: number) {
    setPiezas((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  function actualizar(id: number, patch: Partial<Pieza>) {
    setPiezas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Genera alertas de stock en tiempo real analizando acumulados por producto en la calculadora
  const stockWarnings = useMemo(() => {
    if (!productos || productos.length === 0) return [];
    const productPtMap = new Map<string, number>();
    for (const p of piezasConSubtotal) {
      if (p.inventario_producto_id) {
        const sum = productPtMap.get(p.inventario_producto_id) ?? 0;
        productPtMap.set(p.inventario_producto_id, sum + p.ptTotalReal);
      }
    }
    const warnings: string[] = [];
    for (const [pId, ptVal] of productPtMap.entries()) {
      const prod = productos.find((pr) => pr.id === pId);
      if (prod) {
        const pcRequeridos = ptVal / 12;
        const stockNum = Number(prod.stock_actual) || 0;
        if (stockNum < pcRequeridos) {
          warnings.push(
            `⚠️ El stock de "${prod.nombre}" es insuficiente. Requieres ${pcRequeridos.toFixed(2)} ft³ pero solo quedan ${stockNum.toFixed(2)} ft³.`
          );
        }
      }
    }
    return warnings;
  }, [piezasConSubtotal, productos]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-primary-soft)]/30">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] min-w-[220px]">
                Producto / Descripción
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] w-20">
                Cant.
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] w-20">
                Esp. (in)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] w-20">
                Anch. (in)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] w-20">
                Largo (ft)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] w-24">
                PT Real (u / tot)
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] w-24 text-[var(--color-primary)]">
                PT Com (u / tot)
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {piezasConSubtotal.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-[var(--color-text-secondary)] italic">
                  Calculadora vacía. Haz clic en "Agregar pieza" o selecciona un producto de inventario en la fila para empezar.
                </td>
              </tr>
            ) : (
              piezasConSubtotal.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-1.5 space-y-1.5">
                    {productos && productos.length > 0 ? (
                      <select
                        ref={(el) => {
                          if (el && focusRowId === p.id) {
                            el.focus();
                            setFocusRowId(null);
                          }
                        }}
                        value={p.inventario_producto_id || "manual"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "manual") {
                            actualizar(p.id, {
                              inventario_producto_id: null,
                            });
                          } else {
                            const selectedProd = productos.find((prod) => prod.id === val);
                            if (selectedProd) {
                              const parsed = parseDimensionesDeNombre(selectedProd.nombre);
                              actualizar(p.id, {
                                inventario_producto_id: val,
                                descripcion: parsed.descripcion,
                                espesor: parsed.espesor,
                                ancho: parsed.ancho,
                                largo: parsed.largo,
                              });
                              // Si el costo sugerido está presente y es el primer producto, sugerir cambiar precio global
                              if (selectedProd.costo_unitario && Number(selectedProd.costo_unitario) > 0) {
                                setPrecioInput(String(selectedProd.costo_unitario));
                              }
                            }
                          }
                        }}
                        onKeyDown={handleKeyDown}
                        className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1 text-xs font-semibold outline-none"
                      >
                        <option value="manual">✏️ Escribir manual (sin inventario)</option>
                        {productos.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.nombre} (Stock: {Number(prod.stock_actual).toFixed(1)} {prod.unidad})
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      ref={(el) => {
                        if (el && focusRowId === p.id && (!productos || productos.length === 0)) {
                          el.focus();
                          setFocusRowId(null);
                        }
                      }}
                      className={inputClass}
                      value={p.descripcion}
                      placeholder="Tabla, listón, especie…"
                      onChange={(e) => actualizar(p.id, { descripcion: e.target.value })}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`${inputClass} text-right`}
                      value={p.cantidad === 0 ? "" : p.cantidad}
                      onChange={(e) => actualizar(p.id, { cantidad: Number(e.target.value) || 0 })}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} text-right`}
                      value={p.espesor === 0 ? "" : p.espesor}
                      onChange={(e) => actualizar(p.id, { espesor: Number(e.target.value) || 0 })}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} text-right`}
                      value={p.ancho === 0 ? "" : p.ancho}
                      onChange={(e) => actualizar(p.id, { ancho: Number(e.target.value) || 0 })}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputClass} text-right`}
                      value={p.largo === 0 ? "" : p.largo}
                      onChange={(e) => actualizar(p.id, { largo: Number(e.target.value) || 0 })}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-xs">
                    <span className="text-[var(--color-text-secondary)]">{p.ptUnitarioReal.toFixed(2)}</span>
                    <span className="mx-1 text-[var(--color-border)]">/</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{p.ptTotalReal.toFixed(2)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-xs">
                    <span className="text-[var(--color-text-secondary)]">{p.ptUnitarioComercial}</span>
                    <span className="mx-1 text-[var(--color-border)]">/</span>
                    <span className="font-bold text-[var(--color-primary)]">{p.ptTotalComercial}</span>
                  </td>
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

      {stockWarnings.length > 0 ? (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-3 space-y-1 animate-in fade-in duration-200">
          {stockWarnings.map((warn, index) => (
            <p key={index} className="text-xs font-semibold text-[var(--color-danger)]">{warn}</p>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={agregar} className="h-9 px-3">
          <Plus className="mr-1 size-4" /> Agregar pieza
        </Button>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 bg-[var(--color-primary-soft)]/10 text-[var(--color-primary)]">
            Total PT Comercial: <span className="font-bold">{totalPTComercial}</span>
          </span>
          <span className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)]">
            Total PT Real: <span className="font-bold">{totalPT.toFixed(2)}</span>
          </span>
          <span className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)]">
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
              autoComplete="off"
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
