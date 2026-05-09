"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = {
  idleText: string;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
};

export function PendingSubmitButton({
  idleText,
  pendingText = "Guardando...",
  variant = "primary",
  className,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className={className} disabled={pending}>
      {pending ? pendingText : idleText}
    </Button>
  );
}
