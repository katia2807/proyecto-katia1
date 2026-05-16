import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--katia-bg-base)] px-4 text-center">
      {/* Blob ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute left-1/4 top-1/4 size-96 rounded-full blur-3xl opacity-20"
          style={{ background: "var(--katia-gradient-soft)" }}
        />
      </div>

      <div className="relative z-10 space-y-6">
        <p className="font-mono text-8xl font-bold text-[var(--katia-primary)] opacity-80">
          404
        </p>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--katia-text-primary)]">
            Página no encontrada
          </h1>
          <p className="max-w-sm text-sm text-[var(--katia-text-secondary)]">
            La sección que buscas no existe o fue movida. Vuelve al inicio para continuar.
          </p>
        </div>
        <Link href="/">
          <Button type="button" size="md">
            Volver al inicio
          </Button>
        </Link>
        <p className="text-xs text-[var(--katia-text-disabled)]">Katia Suite v1.0</p>
      </div>
    </div>
  );
}
