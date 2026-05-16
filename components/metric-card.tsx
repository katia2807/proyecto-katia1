import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  /** Color semántico del KPI. */
  status?: "ok" | "warning" | "danger" | "neutral";
  className?: string;
};

const statusStyles: Record<NonNullable<MetricCardProps["status"]>, string> = {
  ok:      "text-[var(--katia-success)]",
  warning: "text-[var(--katia-warning)]",
  danger:  "text-[var(--katia-danger)]",
  neutral: "text-[var(--katia-text-primary)]",
};

export function MetricCard({ label, value, hint, status = "neutral", className }: MetricCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--katia-text-tertiary)]">
        {label}
      </p>
      <p className={cn("mt-2 font-mono text-3xl font-bold leading-none", statusStyles[status])}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-[var(--katia-text-tertiary)]">{hint}</p>
      ) : null}
    </Card>
  );
}
