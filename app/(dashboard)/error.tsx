"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Error capturado por el Boundary del Dashboard:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card variant="glass" className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <div className="flex justify-center text-red-500">
            <span className="text-4xl">⚠️</span>
          </div>
          <CardTitle className="text-xl font-bold text-[var(--katia-text-primary)]">
            Algo salió mal
          </CardTitle>
          <CardDescription className="text-sm text-[var(--katia-text-secondary)]">
            Ocurrió un error inesperado. Por favor intenta de nuevo o contacta al administrador si el problema persiste.
          </CardDescription>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="primary"
            onClick={reset}
            className="w-full sm:w-auto"
          >
            Intentar de nuevo
          </Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--katia-radius-md)] font-semibold transition-all duration-150 border border-[var(--katia-border-default)] bg-[var(--katia-glass-bg)] backdrop-blur-sm text-[var(--katia-text-primary)] hover:border-[var(--katia-border-emphasis)] hover:bg-[var(--katia-primary-soft)] active:scale-[0.98] h-10 px-4 text-sm w-full sm:w-auto"
          >
            Volver al inicio
          </Link>
        </div>

        {error.digest && (
          <p className="text-[10px] font-mono text-[var(--katia-text-tertiary)] opacity-80">
            Código de error: {error.digest}
          </p>
        )}
      </Card>
    </div>
  );
}
