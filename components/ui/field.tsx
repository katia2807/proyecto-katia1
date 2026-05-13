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
          "h-10 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] bg-[var(--bg-primary)] px-3 text-sm outline-none",
          "shadow-[var(--shadow-soft)]",
          "focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
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
          "h-10 rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.1)] bg-[var(--bg-primary)] px-3 text-sm outline-none",
          "shadow-[var(--shadow-soft)]",
          "focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
