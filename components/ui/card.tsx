import type React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-border)_86%,var(--color-accent-soft))]",
        "bg-[linear-gradient(170deg,color-mix(in_srgb,var(--color-surface)_94%,var(--color-accent-soft)_6%),color-mix(in_srgb,var(--color-surface-2)_90%,var(--color-surface)))]",
        "p-5 shadow-[var(--shadow-card)] transition duration-200 hover:border-[var(--color-border-strong)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-bold tracking-tight text-[var(--color-text-primary)]", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-[var(--color-text-secondary)]", className)} {...props} />;
}
