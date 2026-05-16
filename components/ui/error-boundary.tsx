"use client";

import React from "react";
import Link from "next/link";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryState = { hasError: boolean; error: Error | null };

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info);
    }
    // En producción, Sentry lo captura automáticamente via sentry.client.config.ts
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ModuleErrorFallback
          moduleName={this.props.moduleName}
          error={this.state.error}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

type ModuleErrorFallbackProps = {
  moduleName?: string;
  error?: Error | null;
  onReset?: () => void;
};

export function ModuleErrorFallback({ moduleName, error, onReset }: ModuleErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/10 text-[var(--katia-danger)]">
        <IconAlertTriangle className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-[var(--katia-text-primary)]">
          {moduleName ? `Error en ${moduleName}` : "Algo salió mal"}
        </p>
        <p className="max-w-md text-sm text-[var(--katia-text-secondary)]">
          {error?.message && process.env.NODE_ENV !== "production"
            ? error.message
            : "No se pudieron cargar los datos. El equipo ha sido notificado automáticamente."}
        </p>
      </div>
      <div className="flex gap-3">
        {onReset ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReset}
          >
            <IconRefresh className="size-4" />
            Reintentar
          </Button>
        ) : null}
        <Link href="/">
          <Button type="button" variant="ghost" size="sm">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
