"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = {
  fecha: string;
  saldo: number;
};

export function CashFlowChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Sin movimientos de caja para graficar.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="fecha" tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }} />
          <Tooltip
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
