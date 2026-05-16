"use client";

import { formatPen } from "@/lib/utils";
import type { ParetoInventarioMode, ParetoInventarioRow } from "@/lib/inventario-pareto";
import { sumMetricByClase } from "@/lib/inventario-pareto";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COL: Record<string, string> = { A: "#059669", B: "#d97706", C: "#64748b" };

function trunc(s: string, n = 22) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

type Props = {
  rows: ParetoInventarioRow[];
  mode: ParetoInventarioMode;
  totalMetric: number;
};

export function InventarioTomaDecisionesCharts({ rows, mode, totalMetric }: Props) {
  if (rows.length === 0 || totalMetric <= 0) return null;

  const fmtVal = (v: number) =>
    mode === "unidades" ? `${v.toLocaleString("es-PE")} u.` : formatPen(v);

  const claseData = sumMetricByClase(rows);
  const topBars = rows.slice(0, 15).map((r) => ({
    label: trunc(r.producto.nombre),
    nombre: r.producto.nombre,
    metric: r.metric,
    clase: r.clase,
  }));
  const paretoLine = rows.slice(0, Math.min(50, rows.length)).map((r, i) => ({
    rank: i + 1,
    pctAcum: Number(r.pctAcum.toFixed(1)),
    nombre: r.producto.nombre,
    clase: r.clase,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">

      {/* ── Stat cards por clase ── */}
      <Card>
        <CardTitle className="text-base">Distribución A / B / C</CardTitle>
        <CardDescription className="mt-1">
          Cuánto representa cada clase del total ({mode === "unidades" ? "unidades vendidas" : "valor a costo"}).
        </CardDescription>
        <div className="mt-5 space-y-3">
          {claseData.map((d) => {
            const pct = totalMetric > 0 ? (d.value / totalMetric) * 100 : 0;
            const countClase = rows.filter((r) => r.clase === d.clase).length;
            return (
              <div key={d.clase} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--katia-radius-sm)] text-xs font-black text-white"
                  style={{ background: COL[d.clase] }}
                >
                  {d.clase}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--katia-text-primary)]">
                      {d.clase === "A" ? "Prioritarios · foco de compra" : d.clase === "B" ? "Intermedios · mantener" : "Bajo movimiento · revisar"}
                    </span>
                    <span className="font-mono font-semibold text-[var(--katia-text-primary)]">
                      {countClase} prods · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--katia-surface-raised)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%`, background: COL[d.clase] }}
                    />
                  </div>
                  <p className="mt-0.5 text-right font-mono text-[10px] text-[var(--katia-text-tertiary)]">
                    {fmtVal(d.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Curva acumulada (solo línea, sin barras mezcladas) ── */}
      <Card>
        <CardTitle className="text-base">Curva acumulada — Pareto</CardTitle>
        <CardDescription className="mt-1">
          % acumulado de {mode === "unidades" ? "unidades" : "valor"} al incluir cada producto (orden desc.). A=80%, B=95%.
        </CardDescription>
        <div className="mt-4 h-56 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoLine} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--katia-border-subtle)" />
              <XAxis
                dataKey="rank"
                tick={{ fontSize: 10, fill: "var(--katia-text-tertiary)" }}
                label={{ value: "# producto", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--katia-text-tertiary)" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toFixed(1)}%`, "Acumulado"]}
                labelFormatter={(_, p) => {
                  const d = p?.[0]?.payload as { nombre?: string; rank?: number; clase?: string } | undefined;
                  return `#${d?.rank} · ${d?.nombre ?? ""} (${d?.clase ?? ""})`;
                }}
                contentStyle={{ borderRadius: 10, fontSize: 12 }}
              />
              <ReferenceLine y={80} stroke={COL.A} strokeDasharray="6 3" label={{ value: "Clase A · 80%", fill: COL.A, fontSize: 10, position: "insideTopLeft" }} />
              <ReferenceLine y={95} stroke={COL.B} strokeDasharray="6 3" label={{ value: "Clase B · 95%", fill: COL.B, fontSize: 10, position: "insideTopLeft" }} />
              <Line
                type="monotone"
                dataKey="pctAcum"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Top 15 productos (barras horizontales) ── */}
      <Card className="xl:col-span-2">
        <CardTitle className="text-base">Top {topBars.length} productos por {mode === "unidades" ? "unidades vendidas" : "valor estimado"}</CardTitle>
        <CardDescription className="mt-1">
          Verde = Clase A (foco), Naranja = Clase B, Gris = Clase C.
        </CardDescription>
        <div className="mt-4 h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={topBars} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--katia-border-subtle)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "var(--katia-text-tertiary)" }}
                tickFormatter={(v) => (mode === "unidades" ? String(v) : `S/${v}`)}
              />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10, fill: "var(--katia-text-secondary)" }} />
              <Tooltip
                formatter={(v) => [fmtVal(Number(v)), "Volumen"]}
                labelFormatter={(_, p) => (p?.[0]?.payload as { nombre?: string } | undefined)?.nombre ?? ""}
                contentStyle={{ borderRadius: 10, fontSize: 12 }}
              />
              <Bar dataKey="metric" radius={[0, 5, 5, 0]} maxBarSize={18}>
                {topBars.map((r) => (
                  <Cell key={r.nombre} fill={COL[r.clase] ?? "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

    </div>
  );
}
