import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Altura predefinida. Alternativa: pasar className con h-* */
  lines?: number;
};

export function Skeleton({ className, lines, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} className={i === lines - 1 ? "w-3/4" : undefined} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "h-4 rounded-[var(--katia-radius-md)] animate-pulse",
        "bg-[linear-gradient(90deg,var(--katia-glass-bg),var(--katia-glass-border),var(--katia-glass-bg))]",
        "bg-[length:200%_100%]",
        className,
      )}
      style={{ animationDuration: "1.5s" }}
      {...props}
    />
  );
}

export function SkeletonLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "h-3.5 rounded-[var(--katia-radius-sm)] animate-pulse",
        "bg-[var(--katia-glass-border)]",
        className,
      )}
      style={{ animationDuration: "1.5s" }}
      {...props}
    />
  );
}

export function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]",
        "bg-[var(--katia-bg-elevated)] p-5 space-y-3",
        className,
      )}
      {...props}
    >
      <SkeletonLine className="w-1/3 h-4" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--katia-radius-lg)] border border-[var(--katia-border-subtle)]">
      <div className="border-b border-[var(--katia-border-subtle)] bg-[rgba(255,255,255,0.025)] px-3 py-2.5 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="border-b border-[var(--katia-border-subtle)] last:border-0 px-3 py-2.5 flex gap-4"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <SkeletonLine
              key={col}
              className={cn("h-3 flex-1", col === cols - 1 && "max-w-[80px]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
