import type React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--border-radius-card)] border border-[var(--border-color)]",
        "bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition duration-200 hover:border-[var(--color-border-strong)]",
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
