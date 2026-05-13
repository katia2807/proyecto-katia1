import type React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary:
    "border border-transparent bg-[linear-gradient(135deg,var(--accent-primary),var(--accent-secondary))] text-white shadow-[var(--shadow-soft)] hover:brightness-110 active:scale-[0.99]",
  secondary:
    "border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] hover:border-[var(--color-border-strong)] hover:bg-[var(--bg-surface)] active:scale-[0.99]",
  danger:
    "border border-transparent bg-[linear-gradient(135deg,var(--accent-danger),#991b1b)] text-white shadow-[var(--shadow-soft)] hover:brightness-105 active:scale-[0.99]",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
};

export function Button({ className, variant = "primary", type = "submit", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] px-4 text-sm font-semibold transition duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
