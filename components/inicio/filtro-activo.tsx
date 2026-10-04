import Link from "next/link";

export function FiltroActivo({ label, total, clearHref, clearLabel }: {
  label: string;
  total: number;
  clearHref: string;
  clearLabel: string;
}) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--katia-primary)]/30 bg-[var(--katia-primary)]/5 px-4 py-3">
      <p className="text-sm text-[var(--katia-text-primary)]">
        <span className="font-semibold">Filtro activo: {label}</span>
        <span className="ml-2 text-[var(--katia-text-secondary)]">({total} {total === 1 ? "registro" : "registros"})</span>
      </p>
      <Link href={clearHref} className="text-sm font-semibold text-[var(--katia-primary)] hover:underline">
        {clearLabel}
      </Link>
    </div>
  );
}
