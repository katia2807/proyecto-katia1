"use client";

type MargenIndicatorProps = {
  costo: number;
  precio: number;
  /** Etiqueta breve mostrada arriba del indicador. */
  label?: string;
};

/**
 * Indicador en vivo del margen % con semáforo de tres colores:
 * - Rojo  (< 15%)  – riesgo de no cubrir mano de obra ni overhead.
 * - Amber (15-30%) – aceptable pero ajustado.
 * - Verde (≥ 30%)  – margen sano para el taller.
 */
export function MargenIndicator({ costo, precio, label = "Margen estimado" }: MargenIndicatorProps) {
  const margenAbs = precio - costo;
  const margenPct = precio > 0 ? (margenAbs / precio) * 100 : 0;

  let color: "danger" | "warning" | "success" = "success";
  let mensaje = "Margen sano. Avanza con confianza.";
  if (margenPct < 15) {
    color = "danger";
    mensaje = "⚠ Margen bajo: revisa precio o costos antes de cerrar.";
  } else if (margenPct < 30) {
    color = "warning";
    mensaje = "Margen ajustado: confirma que cubres mano de obra y overhead.";
  }

  const bg = {
    danger: "bg-red-50 border-red-300 text-red-800",
    warning: "bg-amber-50 border-amber-300 text-amber-800",
    success: "bg-emerald-50 border-emerald-300 text-emerald-800",
  }[color];

  const dot = {
    danger: "bg-red-500",
    warning: "bg-amber-500",
    success: "bg-emerald-500",
  }[color];

  const formatPen = (n: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 })
      .format(Number.isFinite(n) ? n : 0);

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${bg}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block size-2 rounded-full ${dot}`} />
          <span className="font-semibold">{label}</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none">{margenPct.toFixed(1)}%</p>
          <p className="text-[11px] opacity-80">{formatPen(margenAbs)}</p>
        </div>
      </div>
      <p className="mt-1 text-[11px]">{mensaje}</p>
    </div>
  );
}
