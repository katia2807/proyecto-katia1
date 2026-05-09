import type { EmpresaConfig } from "@/lib/company-config";
import { cn } from "@/lib/utils";

function LogoKatia() {
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-900/40 bg-gradient-to-br from-amber-100 to-amber-200"
      aria-hidden
    >
      <svg viewBox="0 0 48 48" className="h-10 w-10 text-amber-900/90">
        <path
          fill="currentColor"
          d="M24 4l18 10v20L24 44 6 34V14L24 4zm0 4.5L10.5 15.5v17L24 39.5l13.5-7v-17L24 8.5z"
          opacity="0.85"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          d="M14 22c3-4 7-6 10-6s7 2 10 6M16 28c2.5 3 5 4.5 8 4.5s5.5-1.5 8-4.5"
        />
      </svg>
    </div>
  );
}

type EmpresaLogoMarkProps = {
  empresa: EmpresaConfig;
  /** Tailwind (cotización formal / UI). */
  embedded?: boolean;
  /** Estilos inline para DocumentoHeader en impresión. */
  print?: boolean;
};

/**
 * Marca en encabezado de documentos: logo subido o ícono genérico.
 */
export function EmpresaLogoMark({ empresa, embedded = false, print = false }: EmpresaLogoMarkProps) {
  const url = empresa.logo_url?.trim();

  if (url) {
    if (print) {
      return (
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URLs de Storage; imprimible sin optimizer */}
          <img
            src={url}
            alt={empresa.nombre}
            width={56}
            height={56}
            style={{ maxWidth: 56, maxHeight: 56, objectFit: "contain", display: "block" }}
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white",
          embedded ? "border-[var(--color-border)]" : "border-[#ccc]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={empresa.nombre}
          className="max-h-14 max-w-[3.5rem] object-contain"
          width={56}
          height={56}
        />
      </div>
    );
  }

  return <LogoKatia />;
}
