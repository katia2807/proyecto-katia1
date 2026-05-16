import type React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary: [
    "border border-transparent text-white",
    "bg-[var(--katia-gradient-hero)]",
    "shadow-[var(--katia-shadow-soft)]",
    "hover:brightness-110 hover:shadow-[var(--katia-glow-primary)]",
    "active:scale-[0.98]",
  ],
  secondary: [
    "border border-[var(--katia-border-default)]",
    "bg-[var(--katia-glass-bg)] backdrop-blur-sm",
    "text-[var(--katia-text-primary)]",
    "hover:border-[var(--katia-border-emphasis)] hover:bg-[var(--katia-primary-soft)]",
    "active:scale-[0.98]",
  ],
  ghost: [
    "border border-transparent",
    "text-[var(--katia-primary)]",
    "hover:bg-[var(--katia-primary-soft)]",
    "active:scale-[0.98]",
  ],
  danger: [
    "border border-transparent text-white",
    "bg-[linear-gradient(135deg,var(--katia-danger),#991b1b)]",
    "shadow-[var(--katia-shadow-soft)]",
    "hover:brightness-105",
    "active:scale-[0.98]",
  ],
} as const;

const buttonSizes = {
  sm:  "h-8 px-3 text-xs",
  md:  "h-10 px-4 text-sm",
  lg:  "h-12 px-6 text-base",
  icon:"size-10 p-0",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export function Button({ className, variant = "primary", size = "md", type = "submit", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--katia-radius-md)] font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--katia-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--katia-bg-base)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        buttonSizes[size],
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
