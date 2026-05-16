import type React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Variante visual. "glass" aplica glassmorphism completo. "hero" = glass con glow primario. */
  variant?: "default" | "glass" | "hero";
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--katia-radius-lg)] border transition-all duration-200",
        variant === "default" && [
          "border-[var(--katia-border-default)] bg-[var(--katia-bg-elevated)]",
          "p-5 shadow-[var(--katia-shadow-card)]",
          "hover:border-[var(--katia-border-emphasis)] hover:-translate-y-px",
        ],
        variant === "glass" && [
          "border-[var(--katia-glass-border)] p-5",
          "bg-[var(--katia-glass-bg)] backdrop-blur-[var(--katia-glass-blur)]",
          "shadow-[var(--katia-inner-light),var(--katia-shadow-card)]",
          "hover:border-[var(--katia-border-emphasis)] hover:-translate-y-px",
        ],
        variant === "hero" && [
          "border-[rgba(139,92,246,0.25)] p-5",
          "bg-[var(--katia-glass-bg)] backdrop-blur-[var(--katia-glass-blur)]",
          "shadow-[var(--katia-inner-light),var(--katia-shadow-card),var(--katia-glow-primary)]",
          "hover:-translate-y-0.5",
        ],
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold tracking-tight text-[var(--katia-text-primary)]", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-[var(--katia-text-secondary)]", className)} {...props} />;
}

export function CardLabel({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs font-medium uppercase tracking-[0.08em] text-[var(--katia-text-tertiary)]", className)}
      {...props}
    />
  );
}
