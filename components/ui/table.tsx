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
      className={cn("bg-[rgba(255,255,255,0.025)] border-b border-[var(--katia-border-subtle)]", className)}
      {...props}
    />
  );
}

export function TRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--katia-border-subtle)] transition-colors duration-100",
        "hover:bg-[rgba(139,92,246,0.05)]",
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
        "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--katia-text-tertiary)]",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-3 py-2.5 text-sm text-[var(--katia-text-primary)]", className)}
      {...props}
    />
  );
}
