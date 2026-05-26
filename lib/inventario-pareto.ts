/**
 * Pareto / ABC sobre productos de inventario (misma fuente que rankings: vendido + costo promedio).
 */

export type ProductoParetoInput = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  stock_actual: number;
  stock_minimo: number;
  vendido: number;
  costo_unitario_promedio: number;
  unidad?: string;
};

export type ParetoInventarioMode = "unidades" | "valor_costo";

export type ParetoInventarioRow = {
  producto: ProductoParetoInput;
  metric: number;
  pctTotal: number;
  pctAcum: number;
  clase: "A" | "B" | "C";
};

export function metricParetoProducto(p: ProductoParetoInput, mode: ParetoInventarioMode): number {
  if (mode === "unidades") return Number(p.vendido);
  return Number((Number(p.vendido) * Number(p.costo_unitario_promedio)).toFixed(2));
}

export function buildParetoInventarioRows(
  productos: ProductoParetoInput[],
  mode: ParetoInventarioMode,
): { rows: ParetoInventarioRow[]; totalMetric: number; countHasta80: number } {
  const activos = productos.filter((p) => p.activo !== false);
  const sorted = [...activos].sort((a, b) => metricParetoProducto(b, mode) - metricParetoProducto(a, mode));
  const totalMetric = sorted.reduce((s, p) => s + metricParetoProducto(p, mode), 0);
  let cumBefore = 0;
  const rows: ParetoInventarioRow[] = [];
  for (const p of sorted) {
    const m = metricParetoProducto(p, mode);
    const cumBeforePct = totalMetric > 0 ? (cumBefore / totalMetric) * 100 : 0;
    const clase: "A" | "B" | "C" =
      cumBeforePct < 80 ? "A" : cumBeforePct < 95 ? "B" : "C";
    cumBefore += m;
    const pctTotal = totalMetric > 0 ? (m / totalMetric) * 100 : 0;
    const pctAcum = totalMetric > 0 ? (cumBefore / totalMetric) * 100 : 0;
    rows.push({ producto: p, metric: m, pctTotal, pctAcum, clase });
  }
  const idx80 = rows.findIndex((r) => r.pctAcum >= 80);
  const countHasta80 = idx80 >= 0 ? idx80 + 1 : rows.length;
  return { rows, totalMetric, countHasta80 };
}

export function sumMetricByClase(rows: ParetoInventarioRow[]): { name: string; value: number; clase: "A" | "B" | "C" }[] {
  const sums = { A: 0, B: 0, C: 0 };
  for (const r of rows) {
    sums[r.clase] += r.metric;
  }
  return [
    { name: "Clase A (foco compra)", value: sums.A, clase: "A" as const },
    { name: "Clase B (intermedio)", value: sums.B, clase: "B" as const },
    { name: "Clase C (mínimo / revisar)", value: sums.C, clase: "C" as const },
  ].filter((d) => d.value > 0);
}
