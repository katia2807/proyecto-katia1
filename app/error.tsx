"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[GlobalError]", error);
    }
    // Sentry captura automáticamente via sentry.client.config.ts
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A14] px-4 text-center">
        <div className="space-y-6">
          <div className="flex size-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 mx-auto">
            <IconAlertTriangle className="size-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white">Error inesperado</h1>
            <p className="max-w-sm text-sm text-zinc-400">
              Algo salió mal. El equipo técnico fue notificado. Intenta recargar la página.
            </p>
            {error.digest ? (
              <p className="font-mono text-xs text-zinc-600">Código: {error.digest}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <IconRefresh className="size-4" />
              Reintentar
            </button>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-purple-400 transition hover:text-purple-300"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
