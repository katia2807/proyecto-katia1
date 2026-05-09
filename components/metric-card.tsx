import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[var(--color-accent)]" />
        <CardDescription>{label}</CardDescription>
      </div>
      <CardTitle className="mt-1 text-2xl">{value}</CardTitle>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p>
    </Card>
  );
}
