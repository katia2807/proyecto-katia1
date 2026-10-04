"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ReintentarButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button type="button" variant="secondary" disabled={pending} aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Verificando…" : "Reintentar"}
    </Button>
  );
}
