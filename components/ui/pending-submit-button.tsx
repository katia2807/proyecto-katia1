"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = {
  idleText: string;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
};

export function PendingSubmitButton({
  idleText,
  pendingText = "Guardando...",
  variant = "primary",
  className,
  disabled = false,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className={className} disabled={pending || disabled}>
      {pending ? pendingText : idleText}
    </Button>
  );
}
