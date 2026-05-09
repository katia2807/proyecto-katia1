import type React from "react";
import { cn } from "@/lib/utils";

const variants = {
  neutral: "bg-[var(--color-primary-soft)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
  success: "bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_45%,transparent)]",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_45%,transparent)]",
  danger: "bg-[color-mix(in_srgb,var(--color-danger)_18%,transparent)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)]",
} as const;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
