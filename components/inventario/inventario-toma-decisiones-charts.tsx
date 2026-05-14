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
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COL_ABC = { A: "#059669", B: "#d97706", C: "#64748b" };

function truncLabel(s: string, max = 22) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

type Props = {
  rows: ParetoInventarioRow[];
  mode: ParetoInventarioMode;
  totalMetric: number;
};

export function InventarioTomaDecisionesCharts({ rows, mode, totalMetric }: Props) {
  if (rows.length === 0 || totalMetric <= 0) return null;

  const pieData = sumMetricByClase(rows);
  const topBars = rows.slice(0, 12).map((r) => ({
    label: truncLabel(r.producto.nombre, 20),
    nombre: r.producto.nombre,
    metric: r.metric,
    clase: r.clase,
  }));

  const paretoSlice = rows.slice(0, Math.min(40, rows.length)).map((r, i) => ({
    rank: i + 1,
    metric: r.metric,
    pctAcum: Number(r.pctAcum.toFixed(2)),
    nombre: r.producto.nombre,
  }));

  const formatMetric = (v: number) =>
    mode === "unidades" ? `${v.toLocaleString("es-PE")} u.` : formatPen(v);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle className="text-base">Concentración por clase A/B/C</CardTitle>
        <CardDescription className="mt-1">
          Participación del criterio actual (unidades o valor a costo) dentro de cada clase del análisis.
        </CardDescription>
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={2}
                label={(props) => {
                  const pct = typeof props.percent === "number" ? props.percent * 100 : 0;
                  const c = (props as { payload?: { clase?: string } }).payload?.clase ?? "";
                  return `${c} ${pct.toFixed(0)}%`;
                }}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.clase} fill={COL_ABC[entry.clase as keyof typeof COL_ABC]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatMetric(Number(value))}
                contentStyle={{ borderRadius: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-base">Top 12 por volumen del criterio</CardTitle>
        <CardDescription className="mt-1">
          Barras horizontales; el color indica la clase ABC de cada producto en el ranking completo.
        </CardDescription>
        <div className="mt-4 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={topBars} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--color-border)]" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => (mode === "unidades" ? String(v) : `S/${v}`)} />
              <YAxis type="category" dataKey="label" width={118} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value) => formatMetric(Number(value))}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { nombre?: string } | undefined;
                  return p?.nombre ?? "";
                }}
                contentStyle={{ borderRadius: 12 }}
              />
              <Bar dataKey="metric" radius={[0, 6, 6, 0]}>
                {topBars.map((row) => (
                  <Cell key={row.nombre} fill={COL_ABC[row.clase as keyof typeof COL_ABC]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardTitle className="text-base">Curva de Pareto (primeros {paretoSlice.length} ítems)</CardTitle>
        <CardDescription className="mt-1">
          Barras: magnitud del criterio por ranking. Línea: % acumulado (eje derecho). Líneas de referencia 80% y 95%.
        </CardDescription>
        <div className="mt-4 h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoSlice} margin={{ top: 12, right: 28, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--color-border)]" />
              <XAxis dataKey="rank" tick={{ fontSize: 10 }} label={{ value: "Ranking", position: "bottom", offset: 0, fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => (mode === "unidades" ? String(v) : `${Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + "k" : v}`)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value, name) => {
                  const n = String(name);
                  if (n === "% acumulado") return [`${Number(value).toFixed(1)}%`, n];
                  return [formatMetric(Number(value)), mode === "unidades" ? "Volumen" : "Valor est."];
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { nombre?: string; rank?: number } | undefined;
                  return `#${p?.rank ?? ""} · ${p?.nombre ?? ""}`;
                }}
                contentStyle={{ borderRadius: 12 }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="metric" name={mode === "unidades" ? "Unidades" : "Valor (S/)"} fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pctAcum"
                name="% acumulado"
                stroke="#b45309"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <ReferenceLine
                yAxisId="right"
                y={80}
                stroke="#059669"
                strokeDasharray="5 5"
                label={{ value: "80%", position: "insideTopRight", fill: "#059669", fontSize: 11 }}
              />
              <ReferenceLine
                yAxisId="right"
                y={95}
                stroke="#d97706"
                strokeDasharray="5 5"
                label={{ value: "95%", position: "insideBottomRight", fill: "#d97706", fontSize: 11 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
