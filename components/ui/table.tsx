import type React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-sm",
        "overflow-hidden rounded-[var(--border-radius-card)] border border-[var(--border-color)]",
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
        "bg-[rgba(255,255,255,0.03)]",
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
        "border-b border-[var(--border-color)] transition-colors",
        "hover:bg-[rgba(255,255,255,0.02)]",
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
