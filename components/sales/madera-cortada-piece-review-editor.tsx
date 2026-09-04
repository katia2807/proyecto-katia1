"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateMaderaCortadaRealPtPricing } from "@/lib/madera-cortada-pricing";
import { isDetailedMaderaCortadaDescription } from "@/lib/madera-cortada-historical-review";
import { formatPen, roundMoney } from "@/lib/utils";

export type HistoricalReviewPiece = {
  id: number;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  descripcion: string;
  precioUnitarioComercial?: number | null;
  inventario_producto_id?: string | null;
  persisted?: boolean;
};

export type HistoricalPieceReviewCalculation = {
  totalPT: number;
  totalPC: number;
  precioPorPT: number;
  totalSoles: number;
  totalCantidad: number;
  precioUnitarioComercial: number;
  piezas: HistoricalReviewPiece[];
};

type Props = {
  defaultPieces: HistoricalReviewPiece[];
  defaultPrecioPorPT: number;
  onChange: (value: {
    calculation: HistoricalPieceReviewCalculation;
    reviewedPieceIds: number[];
  }) => void;
};

const baseInputClass =
  "h-10 w-full rounded-lg border bg-[var(--color-surface)] px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-500/5 disabled:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function pieceIsComplete(piece: HistoricalReviewPiece) {
  return isDetailedMaderaCortadaDescription(piece.descripcion)
    && piece.cantidad > 0
    && piece.espesor > 0
    && piece.ancho > 0
    && piece.largo > 0;
}

function fieldClass(missing: boolean) {
  return `${baseInputClass} ${
    missing
      ? "border-amber-500/60 bg-amber-500/5"
      : "border-[var(--color-border)]"
  }`;
}

export function MaderaCortadaPieceReviewEditor({
  defaultPieces,
  defaultPrecioPorPT,
  onChange,
}: Props) {
  const [pieces, setPieces] = useState<HistoricalReviewPiece[]>(defaultPieces);
  const [priceInput, setPriceInput] = useState(String(defaultPrecioPorPT || ""));
  const [reviewedPieceIds, setReviewedPieceIds] = useState<number[]>([]);
  const [editingPieceIds, setEditingPieceIds] = useState<number[]>(() =>
    defaultPieces
      .filter((piece) => !pieceIsComplete(piece))
      .map((piece) => piece.id),
  );
  const pricePerPt = positiveNumber(priceInput);

  const pricedPieces = useMemo(() => pieces.map((piece) => {
    const pricing = calculateMaderaCortadaRealPtPricing({
      cantidad: piece.cantidad,
      espesor: piece.espesor,
      ancho: piece.ancho,
      largo: piece.largo,
      precioPorPt: pricePerPt,
    });
    return {
      ...piece,
      precioUnitarioComercial: pricing.precioUnitarioComercial,
      ptUnitarioReal: pricing.ptUnitarioReal,
      ptTotalReal: pricing.ptTotalReal,
      subtotalComercial: pricing.subtotalComercial,
    };
  }), [pieces, pricePerPt]);

  const calculation = useMemo<HistoricalPieceReviewCalculation>(() => {
    const totalPT = pricedPieces.reduce((sum, piece) => sum + piece.ptTotalReal, 0);
    const totalCantidad = pricedPieces.reduce((sum, piece) => sum + piece.cantidad, 0);
    const totalSoles = roundMoney(
      pricedPieces.reduce((sum, piece) => sum + piece.subtotalComercial, 0),
    );
    return {
      totalPT,
      totalPC: totalPT / 12,
      precioPorPT: pricePerPt,
      totalSoles,
      totalCantidad,
      precioUnitarioComercial: totalCantidad > 0 ? totalSoles / totalCantidad : 0,
      piezas: pricedPieces,
    };
  }, [pricePerPt, pricedPieces]);

  useEffect(() => {
    onChange({ calculation, reviewedPieceIds });
  }, [calculation, onChange, reviewedPieceIds]);

  function updatePiece(id: number, patch: Partial<HistoricalReviewPiece>) {
    setReviewedPieceIds((current) => current.filter((pieceId) => pieceId !== id));
    setPieces((current) => current.map((piece) => (
      piece.id === id ? { ...piece, ...patch } : piece
    )));
  }

  function addPiece() {
    const nextId = Math.max(0, ...pieces.map((piece) => piece.id)) + 1;
    setEditingPieceIds((current) => [...current, nextId]);
    setPieces((current) => [
      ...current,
      {
        id: nextId,
        cantidad: 0,
        espesor: 0,
        ancho: 0,
        largo: 0,
        descripcion: "",
        inventario_producto_id: null,
        persisted: false,
      },
    ]);
  }

  function removePiece(id: number) {
    setReviewedPieceIds((current) => current.filter((pieceId) => pieceId !== id));
    setEditingPieceIds((current) => current.filter((pieceId) => pieceId !== id));
    setPieces((current) => current.length > 1
      ? current.filter((piece) => piece.id !== id)
      : current);
  }

  function updatePrice(value: string) {
    setReviewedPieceIds([]);
    setPriceInput(value);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-sm">
        <p className="font-semibold">Los valores guardados ya están cargados</p>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          Revisa una pieza a la vez. Los campos amarillos necesitan información. Cuando confirmes una pieza quedará bloqueada; puedes reabrirla si necesitas corregirla.
        </p>
      </div>

      <label className="block max-w-sm space-y-1.5 text-sm font-semibold">
        Precio por PT (S/)
        <input
          type="number"
          min="0.01"
          step="0.01"
          name="precio_por_pt"
          value={priceInput}
          onChange={(event) => updatePrice(event.target.value)}
          className={fieldClass(pricePerPt <= 0)}
          aria-label="Precio por PT de la corrección"
          placeholder="No registrado"
        />
        <span className="block text-xs font-normal text-[var(--color-text-secondary)]">
          Si cambias este precio, todas las piezas deberán confirmarse nuevamente.
        </span>
      </label>

      <div className="space-y-4">
        {pricedPieces.map((piece, index) => {
          const reviewed = reviewedPieceIds.includes(piece.id);
          const editing = editingPieceIds.includes(piece.id) && !reviewed;
          const complete = pieceIsComplete(piece) && pricePerPt > 0;
          const descriptionMissing = !isDetailedMaderaCortadaDescription(piece.descripcion);
          return (
            <article
              key={piece.id}
              aria-label={`Revisión de pieza ${index + 1}`}
              className={`rounded-xl border p-4 ${
                reviewed
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {reviewed ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <CircleAlert className="size-5 text-amber-600" />
                  )}
                  <div>
                    <h4 className="font-bold">Pieza {index + 1}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {piece.persisted ? "Datos recuperados de la venta" : "Nueva pieza agregada durante la revisión"}
                    </p>
                  </div>
                  <Badge variant={reviewed ? "success" : complete ? "warning" : "danger"}>
                    {reviewed ? "Revisada" : editing ? "En edición" : "Por revisar"}
                  </Badge>
                </div>
                {!piece.persisted && !reviewed && pieces.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removePiece(piece.id)}
                    className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-600"
                    aria-label={`Eliminar pieza ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  Descripción detallada
                  <input
                    value={piece.descripcion}
                    disabled={!editing}
                    onChange={(event) => updatePiece(piece.id, { descripcion: event.target.value })}
                    className={fieldClass(descriptionMissing)}
                    aria-label={`Descripción de la pieza ${index + 1}`}
                    placeholder="Ej.: Tabla de roble"
                    autoComplete="off"
                  />
                  {descriptionMissing ? (
                    <span className="block text-[11px] font-normal normal-case tracking-normal text-amber-700">
                      Escribe el tipo o especie; una descripción genérica no es suficiente para el cliente.
                    </span>
                  ) : null}
                </label>

                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { key: "cantidad", label: "Cantidad", unit: "pzs", value: piece.cantidad, step: "1" },
                    { key: "espesor", label: "Espesor", unit: "pulgadas", value: piece.espesor, step: "0.01" },
                    { key: "ancho", label: "Ancho", unit: "pulgadas", value: piece.ancho, step: "0.01" },
                    { key: "largo", label: "Largo", unit: "pies", value: piece.largo, step: "0.01" },
                  ].map((field) => (
                    <label key={field.key} className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {field.label} <span className="normal-case">({field.unit})</span>
                      <input
                        type="number"
                        min="0.01"
                        step={field.step}
                        value={field.value > 0 ? field.value : ""}
                        disabled={!editing}
                        onChange={(event) => updatePiece(piece.id, {
                          [field.key]: positiveNumber(event.target.value),
                        })}
                        className={fieldClass(field.value <= 0)}
                        aria-label={`${field.label} de la pieza ${index + 1}`}
                        placeholder="No registrado"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-soft)]/20 p-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-[var(--color-text-secondary)]">PT por pieza</p><p className="font-bold">{piece.ptUnitarioReal.toFixed(2)}</p></div>
                  <div><p className="text-xs text-[var(--color-text-secondary)]">PT total</p><p className="font-bold">{piece.ptTotalReal.toFixed(2)}</p></div>
                  <div><p className="text-xs text-[var(--color-text-secondary)]">Precio por pieza</p><p className="font-bold">{formatPen(piece.precioUnitarioComercial)}</p></div>
                  <div><p className="text-xs text-[var(--color-text-secondary)]">Subtotal</p><p className="font-bold">{formatPen(piece.subtotalComercial)}</p></div>
                </div>

                <div className="flex justify-end">
                  {reviewed ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setReviewedPieceIds((current) => current.filter((id) => id !== piece.id));
                        setEditingPieceIds((current) => current.includes(piece.id)
                          ? current
                          : [...current, piece.id]);
                      }}
                      aria-label={`Editar pieza ${index + 1}`}
                    >
                      <Pencil className="size-4" /> Editar esta pieza
                    </Button>
                  ) : !editing ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingPieceIds((current) => [...current, piece.id])}
                        aria-label={`Modificar pieza ${index + 1}`}
                      >
                        <Pencil className="size-4" /> Modificar esta pieza
                      </Button>
                      <Button
                        type="button"
                        disabled={!complete}
                        onClick={() => setReviewedPieceIds((current) => current.includes(piece.id)
                          ? current
                          : [...current, piece.id])}
                        aria-label={`Confirmar pieza ${index + 1}`}
                      >
                        <CheckCircle2 className="size-4" /> Los datos están correctos
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      disabled={!complete}
                      onClick={() => {
                        setReviewedPieceIds((current) => current.includes(piece.id)
                          ? current
                          : [...current, piece.id]);
                        setEditingPieceIds((current) => current.filter((id) => id !== piece.id));
                      }}
                      aria-label={`Confirmar pieza ${index + 1}`}
                    >
                      <CheckCircle2 className="size-4" /> Confirmar pieza {index + 1}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
        <Button type="button" variant="secondary" onClick={addPiece}>
          <Plus className="size-4" /> Agregar una pieza que falta
        </Button>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Úsalo solamente si la venta incluía otra medida o tipo de madera que no aparece arriba.
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border border-[var(--color-border)] p-4 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-[var(--color-text-secondary)]">Piezas confirmadas</p><p className="font-bold">{reviewedPieceIds.length} de {pieces.length}</p></div>
        <div><p className="text-xs text-[var(--color-text-secondary)]">Total de piezas</p><p className="font-bold">{calculation.totalCantidad}</p></div>
        <div><p className="text-xs text-[var(--color-text-secondary)]">Total PT real</p><p className="font-bold">{calculation.totalPT.toFixed(2)} PT</p></div>
        <div><p className="text-xs text-[var(--color-text-secondary)]">Total calculado</p><p className="font-bold">{formatPen(calculation.totalSoles)}</p></div>
      </div>

      <input type="hidden" name="lineas_cubicaje" value={JSON.stringify(pricedPieces)} />
      <input type="hidden" name="piezas_confirmadas" value={JSON.stringify(reviewedPieceIds)} />
    </div>
  );
}
