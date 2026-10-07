"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPen } from "@/lib/utils";

type Point = {
  fecha: string;
  saldo: number;
};

export function CashFlowChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Sin movimientos de caja para graficar.</p>;
  }

  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label={`Saldo de empresa en 30 días. Último saldo: ${formatPen(data.at(-1)?.saldo)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="fecha" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
          <YAxis width={60} tickFormatter={(value) => `S/ ${Number(value).toLocaleString("es-PE", { notation: "compact" })}`} tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [formatPen(Number(value)), "Saldo de empresa"]}
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-text-primary)",
            }}
          />
          <Line type="monotone" dataKey="saldo" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
