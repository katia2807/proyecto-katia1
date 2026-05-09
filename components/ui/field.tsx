import type React from "react";
import { cn } from "@/lib/utils";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Field({ label, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
      {label}
      <input
        className={cn(
          "h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-surface-2))] px-3 text-sm outline-none",
          "shadow-[var(--shadow-soft)]",
          "focus-visible:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          className,
        )}
        {...props}
      />
    </label>
  );
}

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
};

export function SelectField({ label, className, children, ...props }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
      {label}
      <select
        className={cn(
          "h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-surface-2))] px-3 text-sm outline-none",
          "shadow-[var(--shadow-soft)]",
          "focus-visible:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
