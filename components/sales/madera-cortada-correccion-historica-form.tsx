"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CubicajeInput } from "@/components/sales/cubicaje-input";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import {
  maderaCortadaHistoricalStatusLabels,
  reviewMaderaCortadaHistoricalSale,
} from "@/lib/madera-cortada-historical-review";
import {
  buildMaderaCortadaPrintModel,
  buildMaderaCortadaVoucherLines,
  getMaderaCortadaCustomerItems,
} from "@/lib/madera-cortada-print-model";
import { formatDate, formatPen, roundMoney } from "@/lib/utils";

type EditablePiece = {
  id: number;
  cantidad: number;
  espesor: number;
  ancho: number;
  largo: number;
  descripcion: string;
  precioUnitarioComercial?: number | null;
  inventario_producto_id?: string | null;
};

type Calculation = {
  totalPT: number;
  totalPC: number;
  precioPorPT: number;
  totalSoles: number;
  totalCantidad: number;
  precioUnitarioComercial: number;
  piezas: EditablePiece[];
};

export type HistoricalMaderaSaleForCorrection = {
  id: string;
  cliente_id: string;
  fecha: string;
  estado: string;
  tipo_corte: string | null;
  total_pt: number;
  precio_por_pt: number;
  cantidad_piezas: number | null;
  precio_unitario_comercial: number | null;
  lineas_comprobante: unknown;
  tipo_comprobante: string;
  total: number;
  modalidad_pago: string | null;
};

type Props = {
  venta: HistoricalMaderaSaleForCorrection;
  clienteNombre: string;
  activeCashMovements: Array<{ id: string; monto: number; periodo_cerrado: boolean }>;
  inventoryMovements: Array<{ id: string; cantidad: number }>;
  panelAction: (formData: FormData) => void;
};

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

function completePiece(piece: EditablePiece) {
  return Boolean(piece.descripcion.trim())
    && piece.cantidad > 0
    && piece.espesor > 0
    && piece.ancho > 0
    && piece.largo > 0;
}

export function MaderaCortadaCorreccionHistoricaForm({
  venta,
  clienteNombre,
  activeCashMovements,
  inventoryMovements,
  panelAction,
}: Props) {
  const review = useMemo(() => reviewMaderaCortadaHistoricalSale(venta), [venta]);
  const defaultPieces = useMemo<EditablePiece[]>(() => {
    if (review.storedLines.length === 0) {
      return [{
        id: 1,
        cantidad: Number(venta.cantidad_piezas ?? 0),
        espesor: 0,
        ancho: 0,
        largo: 0,
        descripcion: "",
        inventario_producto_id: null,
      }];
    }
    return review.storedLines.map((line, index) => ({
      id: index + 1,
      cantidad: line.cantidad,
      espesor: line.espesor,
      ancho: line.ancho,
      largo: line.largo,
      descripcion: line.descripcion,
      precioUnitarioComercial: line.precio_unitario,
      inventario_producto_id: null,
    }));
  }, [review.storedLines, venta.cantidad_piezas]);
  const [step, setStep] = useState(1);
  const [calculation, setCalculation] = useState<Calculation>(() => ({
    totalPT: review.calculatedTotalPt,
    totalPC: review.calculatedTotalPt / 12,
    precioPorPT: Number(venta.precio_por_pt),
    totalSoles: review.calculatedSubtotal,
    totalCantidad: review.calculatedQuantity,
    precioUnitarioComercial: review.calculatedQuantity > 0
      ? review.calculatedSubtotal / review.calculatedQuantity
      : 0,
    piezas: defaultPieces,
  }));
  const [totalMode, setTotalMode] = useState<"calculado" | "registrado" | "manual">("calculado");
  const [manualTotal, setManualTotal] = useState(String(venta.total));
  const [confirmed, setConfirmed] = useState(false);

  const allComplete = calculation.piezas.length > 0 && calculation.piezas.every(completePiece);
  const ptDifference = calculation.totalPT - Number(venta.total_pt);
  const ptMatches = Math.abs(ptDifference) <= 0.01;
  const nextTotal = totalMode === "registrado"
    ? roundMoney(Number(venta.total))
    : totalMode === "manual"
      ? roundMoney(Number(manualTotal) || 0)
      : roundMoney(calculation.totalSoles);
  const changesTotal = Math.abs(nextTotal - Number(venta.total)) >= 0.01;
  const cashIsBlocked = changesTotal
    && venta.modalidad_pago === "contado"
    && (activeCashMovements.length !== 1 || activeCashMovements[0]?.periodo_cerrado);
  const canReview = allComplete && ptMatches && calculation.precioPorPT > 0;

  const previewItems = useMemo(() => {
    const lines = buildMaderaCortadaVoucherLines(calculation.piezas, calculation.precioPorPT);
    const model = buildMaderaCortadaPrintModel({
      ...venta,
      precio_por_pt: calculation.precioPorPT,
      cantidad_piezas: calculation.totalCantidad,
      precio_unitario_comercial: calculation.precioUnitarioComercial,
      lineas_comprobante: lines,
      total: nextTotal,
    });
    return getMaderaCortadaCustomerItems(model.items, model.totalSoles);
  }, [calculation, nextTotal, venta]);

  return (
    <form action={panelAction} className="space-y-6">
      <input type="hidden" name="id" value={venta.id} />
      <input type="hidden" name="total_mode" value={totalMode} />

      <div className="grid gap-2 sm:grid-cols-3">
        {["Revisar original", "Completar detalle", "Confirmar corrección"].map((label, index) => {
          const number = index + 1;
          return (
            <div
              key={label}
              className={`rounded-xl border px-3 py-2 text-sm ${
                number === step
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/35 font-bold"
                  : number < step
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              {number}. {label}
            </div>
          );
        })}
      </div>

      <section className={step === 1 ? "space-y-5" : "hidden"} aria-hidden={step !== 1}>
        <div className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-[var(--color-text-secondary)]">Cliente</p><p className="font-semibold">{clienteNombre}</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">Fecha</p><p className="font-semibold">{formatDate(venta.fecha)}</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">PT registrado</p><p className="font-semibold">{Number(venta.total_pt).toFixed(2)} PT</p></div>
          <div><p className="text-xs text-[var(--color-text-secondary)]">Total cobrado</p><p className="font-semibold">{formatPen(Number(venta.total))}</p></div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <h3 className="font-semibold">Resultado de la revisión</h3>
            <Badge variant={review.status === "correcta" ? "success" : "warning"}>
              {maderaCortadaHistoricalStatusLabels[review.status]}
            </Badge>
          </div>
          {review.issues.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
              {review.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>• {issue.message}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              El detalle guardado ya coincide. Puedes revisarlo antes de confirmar.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4" /> Protección activa</p>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            Esta función corrige la información de la boleta. No modifica el inventario y no permite guardar medidas que cambien el PT registrado.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => setStep(2)}>
            Completar detalle <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <section className={step === 2 ? "space-y-5" : "hidden"} aria-hidden={step !== 2}>
        <div>
          <h3 className="font-semibold">Descripción, cantidad y medidas reales</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Escribe un detalle breve para el cliente, por ejemplo: “Roble”, 4 piezas, 1 × 8 × 10.
          </p>
        </div>

        <CubicajeInput
          defaultPiezas={defaultPieces}
          defaultPrecioPorPT={String(venta.precio_por_pt)}
          precioEditable
          quantityMode="visible"
          unitPriceMode="real-pt-calculated"
          onChange={setCalculation}
        />

        {!allComplete ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
            Completa la descripción, cantidad, espesor, ancho y largo de todas las piezas.
          </p>
        ) : null}
        {!ptMatches ? (
          <p className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-sm text-red-700">
            Las medidas suman {calculation.totalPT.toFixed(2)} PT, pero la venta registró {Number(venta.total_pt).toFixed(2)} PT. Diferencia: {Math.abs(ptDifference).toFixed(2)} PT. No se puede continuar sin revisar las medidas.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
          <Button type="button" disabled={!canReview} onClick={() => setStep(3)}>
            Revisar resultado <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <section className={step === 3 ? "space-y-5" : "hidden"} aria-hidden={step !== 3}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <h3 className="font-semibold">Antes</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt>Detalle</dt><dd>{review.storedLines.length > 0 ? `${review.storedLines.length} línea(s)` : "Sin detalle"}</dd></div>
              <div className="flex justify-between gap-3"><dt>Precio por PT</dt><dd>{formatPen(Number(venta.precio_por_pt))}</dd></div>
              <div className="flex justify-between gap-3 font-semibold"><dt>Total</dt><dd>{formatPen(Number(venta.total))}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-emerald-600" /> Después</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt>Detalle</dt><dd>{calculation.piezas.length} línea(s) completas</dd></div>
              <div className="flex justify-between gap-3"><dt>Precio por PT</dt><dd>{formatPen(calculation.precioPorPT)}</dd></div>
              <div className="flex justify-between gap-3 font-semibold"><dt>Total</dt><dd>{formatPen(nextTotal)}</dd></div>
            </dl>
          </div>
        </div>

        <fieldset className="space-y-2 rounded-xl border border-[var(--color-border)] p-4">
          <legend className="px-1 text-sm font-semibold">Total que quedará registrado</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="total_mode_choice" checked={totalMode === "calculado"} onChange={() => setTotalMode("calculado")} />
            <span><strong>Usar cálculo por PT real ({formatPen(calculation.totalSoles)})</strong><br /><span className="text-[var(--color-text-secondary)]">Recomendado cuando el total antiguo estaba mal calculado.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="total_mode_choice" checked={totalMode === "registrado"} onChange={() => setTotalMode("registrado")} />
            <span><strong>Conservar total cobrado ({formatPen(Number(venta.total))})</strong><br /><span className="text-[var(--color-text-secondary)]">Solo corrige el detalle visible de la boleta.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="total_mode_choice" checked={totalMode === "manual"} onChange={() => setTotalMode("manual")} />
            <span className="flex-1"><strong>Usar total confirmado manualmente</strong>
              {totalMode === "manual" ? (
                <input
                  name="total_manual"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualTotal}
                  onChange={(event) => setManualTotal(event.target.value)}
                  className={`${inputClass} mt-2 max-w-xs`}
                />
              ) : null}
            </span>
          </label>
        </fieldset>

        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="bg-[var(--color-primary-soft)]/25 px-4 py-3">
            <h3 className="font-semibold">Vista previa para el cliente</h3>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-[var(--color-text-secondary)]"><tr><th className="pb-2">Cant.</th><th className="pb-2">Descripción</th><th className="pb-2 text-right">P. unit.</th><th className="pb-2 text-right">Importe</th></tr></thead>
              <tbody>
                {previewItems.map((item, index) => (
                  <tr key={`${item.desc}-${index}`} className="border-t border-[var(--color-border)]">
                    <td className="py-2">{item.qty}</td><td className="py-2">{item.desc}</td><td className="py-2 text-right">{item.unitario}</td><td className="py-2 text-right font-semibold">{item.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t border-[var(--color-border)] text-base font-bold"><td colSpan={3} className="pt-3 text-right">TOTAL</td><td className="pt-3 text-right">{formatPen(nextTotal)}</td></tr></tfoot>
            </table>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className={`rounded-xl border p-4 text-sm ${cashIsBlocked ? "border-red-500/30 bg-red-500/5" : "border-[var(--color-border)]"}`}>
            <p className="font-semibold">Efecto en caja</p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              {!changesTotal
                ? "El total no cambia; caja queda igual."
                : venta.modalidad_pago !== "contado"
                  ? "La modalidad no es contado; el cobro registrado queda igual."
                  : cashIsBlocked
                    ? "No se puede guardar: caja necesita un único movimiento activo y abierto."
                    : `${formatPen(activeCashMovements[0]?.monto ?? venta.total)} → ${formatPen(nextTotal)}.`}
            </p>
          </div>
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-sm">
            <p className="font-semibold">Efecto en inventario</p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              Sin cambios. Se conservarán los {inventoryMovements.length} movimiento(s) asociados y el mismo PT registrado.
            </p>
          </div>
        </div>

        <label className="block space-y-1.5 text-sm font-semibold">
          Motivo de la corrección *
          <textarea
            name="motivo_correccion"
            required
            minLength={10}
            rows={3}
            placeholder="Ej.: Se completó especie y medidas solicitadas por el cliente."
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          />
        </label>
        <label className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] p-3 text-sm">
          <input name="confirmacion" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>Confirmo que revisé la boleta, el total y el efecto indicado en caja. Entiendo que el inventario no cambiará.</span>
        </label>

        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setStep(2)}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
          <PendingSubmitButton
            idleText="Guardar corrección revisada"
            disabled={!confirmed || cashIsBlocked || nextTotal <= 0}
          />
        </div>
      </section>
    </form>
  );
}
