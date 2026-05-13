import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardDescription className="text-xs uppercase tracking-[0.08em]">{label}</CardDescription>
        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          Estable
        </span>
      </div>
      <CardTitle className="mt-2 text-[28px] font-medium">{value}</CardTitle>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p>
    </Card>
  );
}
