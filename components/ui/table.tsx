import type React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-sm",
        "overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]",
        className,
      )}
      {...props}
    />
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-primary-soft)_78%,var(--color-surface)),color-mix(in_srgb,var(--color-primary-soft)_58%,var(--color-surface)))]",
        className,
      )}
      {...props}
    />
  );
}

export function TRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--color-border)] transition-colors",
        "hover:bg-[color-mix(in_srgb,var(--color-primary-soft)_58%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 text-[var(--color-text-primary)]", className)} {...props} />;
}
