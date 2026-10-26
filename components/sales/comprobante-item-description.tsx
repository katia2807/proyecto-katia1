type Props = { item: { desc: string; medidas?: string }; prefix?: string; compact?: boolean };

export function ComprobanteItemDescription({ item, prefix = "", compact = false }: Props) {
  return <div className="min-w-0 whitespace-normal break-words leading-snug">
    <p className="font-semibold">{prefix}{item.desc}</p>
    {item.medidas ? <p data-medidas-registradas className={"mt-1 font-normal text-[var(--color-text-secondary,#64748b)] " + (compact ? "text-[10px]" : "text-xs")}>
      Medidas registradas: {item.medidas}
    </p> : null}
  </div>;
}
